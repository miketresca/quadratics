import pytest

from app.api.routes import generations
from app.core.config import Settings, get_settings
from app.schemas.narration import AudioAlignment
from app.services.narration.base import NarrationProvider, NarrationRequest, NarrationResult
from app.services.usage.costs import InMemoryUsageCostRepository


class UsageCostNarrationProvider(NarrationProvider):
    async def generate(self, request: NarrationRequest) -> NarrationResult:
        return NarrationResult(
            provider="elevenlabs",
            audio_base64="ZmFrZS1tcDM=",
            audio_mime_type="audio/mpeg",
            duration_seconds=1.2,
            normalized_alignment=AudioAlignment(
                characters=list(request.text),
                character_start_times_seconds=[index * 0.01 for index in range(len(request.text))],
                character_end_times_seconds=[
                    (index + 1) * 0.01 for index in range(len(request.text))
                ],
            ),
            provider_metadata={"model": "eleven_multilingual_v2"},
        )


@pytest.mark.asyncio
async def test_usage_summary_tracks_elevenlabs_generation_cost(
    authenticated_client,
    app,
    monkeypatch,
):
    monkeypatch.setattr(
        generations,
        "_narration_provider",
        lambda _settings: UsageCostNarrationProvider(),
    )
    app.dependency_overrides[get_settings] = lambda: Settings(
        app_environment="test",
        supabase_url="",
        supabase_service_role_key="",
        script_generation_enabled=False,
        elevenlabs_api_key="test-key",
        elevenlabs_cost_per_credit_usd=0.01,
    )
    try:
        created = await authenticated_client.post(
            "/api/v1/generations",
            json={"equation": "x^2 + 5*x + 6 = 0", "instructorId": "male"},
        )
        generation_id = created.json()["job"]["id"]
        await authenticated_client.post(
            f"/api/v1/generations/{generation_id}/stages/teacher_script",
            json={},
        )
        audio = await authenticated_client.post(
            f"/api/v1/generations/{generation_id}/stages/elevenlabs_audio",
            json={"force": True},
        )
        summary = await authenticated_client.get("/api/v1/usage/summary")
        events = await authenticated_client.get("/api/v1/usage/events")
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert audio.status_code == 200
    assert summary.status_code == 200
    assert events.status_code == 200
    body = summary.json()
    breakdown = body["userBreakdown"][0]
    expected_cost = breakdown["quantity"] * 0.01

    assert body["userTotalCostUsd"] == expected_cost
    assert body["globalAverageCostPerVideoUsd"] == expected_cost
    assert body["globalAverageCostPerVideoWithoutAvatarUsd"] == expected_cost
    assert body["globalAverageCostPerVideoWithAvatarUsd"] == expected_cost
    assert body["globalVideoCount"] == 1
    assert body["userBreakdown"] == [
        {
            "provider": "elevenlabs",
            "stage": "elevenlabs_audio",
            "unitType": "credits",
            "quantity": breakdown["quantity"],
            "costUsd": expected_cost,
        }
    ]

    event = events.json()["events"][0]
    assert event["provider"] == "elevenlabs"
    assert event["stage"] == "elevenlabs_audio"
    assert event["model"] == "eleven_multilingual_v2"
    assert event["unitType"] == "credits"
    assert event["quantity"] == breakdown["quantity"]
    assert event["costUsd"] == expected_cost
    assert event["createdAt"]


@pytest.mark.asyncio
async def test_usage_summary_averages_heygen_runs_instead_of_summing_per_generation():
    repository = InMemoryUsageCostRepository()
    user_id = "9f09c87d-1111-4222-8333-111111111111"
    generation_id = "9f09c87d-2222-4333-8444-222222222222"
    await repository.record(
        user_id=user_id,
        generation_job_id=generation_id,
        stage="teacher_script",
        provider="openai",
        model="gpt-5-mini",
        unit_type="tokens",
        quantity=1,
        unit_cost_usd=0.06,
    )
    await repository.record(
        user_id=user_id,
        generation_job_id=generation_id,
        stage="heygen_avatar",
        provider="heygen",
        model="avatar_iv",
        unit_type="seconds",
        quantity=1,
        unit_cost_usd=3.10,
        metadata={"completeStage": True},
    )
    await repository.record(
        user_id=user_id,
        generation_job_id=generation_id,
        stage="heygen_avatar",
        provider="heygen",
        model="avatar_iii",
        unit_type="seconds",
        quantity=1,
        unit_cost_usd=0.78,
        metadata={"completeStage": True},
    )

    summary = await repository.summary(user_id)

    assert summary.global_average_cost_per_video_without_avatar_usd == pytest.approx(0.06)
    assert summary.global_average_cost_per_video_with_avatar_usd == pytest.approx(2.0)
