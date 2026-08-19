import pytest

from app.api.routes import generations
from app.core.config import Settings, get_settings
from app.schemas.narration import AudioAlignment
from app.services.narration.base import NarrationProvider, NarrationRequest, NarrationResult


class CountingNarrationProvider(NarrationProvider):
    def __init__(self) -> None:
        self.requests: list[NarrationRequest] = []

    async def generate(self, request: NarrationRequest) -> NarrationResult:
        self.requests.append(request)
        return NarrationResult(
            provider="elevenlabs",
            audio_base64="ZmFrZS1tcDM=",
            audio_mime_type="audio/mpeg",
            duration_seconds=1.2,
            normalized_alignment=AudioAlignment(
                characters=["H", "i"],
                character_start_times_seconds=[0, 0.2],
                character_end_times_seconds=[0.2, 0.4],
            ),
            provider_metadata={"model": "eleven_multilingual_v2"},
        )


@pytest.mark.asyncio
async def test_generation_stage_can_create_script_artifact(authenticated_client, app):
    app.dependency_overrides[get_settings] = lambda: Settings(script_generation_enabled=False)
    try:
        created = await authenticated_client.post(
            "/api/v1/generations",
            json={"equation": "x^2 + 5*x + 6 = 0"},
        )
        generation_id = created.json()["job"]["id"]

        response = await authenticated_client.post(
            f"/api/v1/generations/{generation_id}/stages/teacher_script",
            json={},
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 200
    body = response.json()
    stages = [artifact["stage"] for artifact in body["artifacts"]]
    assert stages == ["solution", "lesson", "teacher_script"]
    script_artifact = body["artifacts"][-1]
    assert script_artifact["status"] == "completed"
    assert script_artifact["payload"]["status"] == "completed"
    assert script_artifact["upstreamArtifactIds"] == [body["artifacts"][1]["id"]]


@pytest.mark.asyncio
async def test_generation_stage_persists_narration_and_reuses_identical_audio(
    authenticated_client,
    app,
    monkeypatch,
):
    provider = CountingNarrationProvider()
    app.dependency_overrides[get_settings] = lambda: Settings(
        script_generation_enabled=False,
        elevenlabs_api_key="test-key",
        elevenlabs_male_voice_id="male-voice",
    )
    monkeypatch.setattr(generations, "_narration_provider", lambda _settings: provider)
    try:
        created = await authenticated_client.post(
            "/api/v1/generations",
            json={"equation": "x^2 + 5*x + 6 = 0"},
        )
        generation_id = created.json()["job"]["id"]
        await authenticated_client.post(
            f"/api/v1/generations/{generation_id}/stages/teacher_script",
            json={},
        )

        first = await authenticated_client.post(
            f"/api/v1/generations/{generation_id}/stages/elevenlabs_audio",
            json={},
        )
        second = await authenticated_client.post(
            f"/api/v1/generations/{generation_id}/stages/elevenlabs_audio",
            json={},
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert first.status_code == 200
    assert second.status_code == 200
    assert len(provider.requests) == 3
    audio_artifacts = [
        artifact
        for artifact in second.json()["artifacts"]
        if artifact["stage"] == "elevenlabs_audio"
    ]
    assert len(audio_artifacts) == 1
    assert audio_artifacts[0]["status"] == "completed"
    assert audio_artifacts[0]["storageObjects"]
    assert "audioBase64" not in audio_artifacts[0]["payload"]["segments"][0]
