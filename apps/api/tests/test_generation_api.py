import pytest

from app.api.routes import generations
from app.core.config import Settings, get_settings
from app.schemas.narration import AudioAlignment
from app.services.animation.base import AnimationPlanningRequest, AnimationPlanProvider
from app.services.narration.base import NarrationProvider, NarrationRequest, NarrationResult
from app.services.storage.media_store import MediaStore


class FailingAnimationPlanProvider(AnimationPlanProvider):
    async def generate_animation_plan(self, request: AnimationPlanningRequest):
        raise RuntimeError("planner exploded")


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
            normalized_alignment=alignment_for(request.text),
            provider_metadata={"model": "eleven_multilingual_v2"},
        )


class FailingMediaStore(MediaStore):
    def put(self, **_kwargs):
        raise RuntimeError("media upload failed")


def alignment_for(text: str) -> AudioAlignment:
    characters = list(text)
    starts = [index * 0.05 for index, _ in enumerate(characters)]
    ends = [start + 0.05 for start in starts]
    return AudioAlignment(
        characters=characters,
        character_start_times_seconds=starts,
        character_end_times_seconds=ends,
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


@pytest.mark.asyncio
async def test_generation_run_all_completes_through_base_video(
    authenticated_client,
    app,
    monkeypatch,
):
    provider = CountingNarrationProvider()
    app.dependency_overrides[get_settings] = lambda: Settings(
        script_generation_enabled=False,
        elevenlabs_api_key="test-key",
    )
    monkeypatch.setattr(generations, "_narration_provider", lambda _settings: provider)
    try:
        created = await authenticated_client.post(
            "/api/v1/generations",
            json={"equation": "x^2 + 5*x + 6 = 0"},
        )
        generation_id = created.json()["job"]["id"]

        response = await authenticated_client.post(
            f"/api/v1/generations/{generation_id}/run-all",
            json={},
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 200
    stages = [artifact["stage"] for artifact in response.json()["artifacts"]]
    assert stages == [
        "solution",
        "lesson",
        "teacher_script",
        "elevenlabs_request",
        "elevenlabs_audio",
        "animation_plan",
        "resolved_timeline",
        "motion_canvas_render",
        "base_video",
    ]
    assert len(provider.requests) == 3


@pytest.mark.asyncio
async def test_animation_plan_stage_does_not_regenerate_elevenlabs_audio(
    authenticated_client,
    app,
    monkeypatch,
):
    provider = CountingNarrationProvider()
    app.dependency_overrides[get_settings] = lambda: Settings(
        script_generation_enabled=False,
        elevenlabs_api_key="test-key",
    )
    monkeypatch.setattr(generations, "_narration_provider", lambda _settings: provider)
    try:
        created = await authenticated_client.post(
            "/api/v1/generations",
            json={"equation": "x^2 + 5*x + 6 = 0"},
        )
        generation_id = created.json()["job"]["id"]
        await authenticated_client.post(f"/api/v1/generations/{generation_id}/run-all", json={})

        response = await authenticated_client.post(
            f"/api/v1/generations/{generation_id}/stages/animation_plan",
            json={"force": True},
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 200
    assert len(provider.requests) == 3


@pytest.mark.asyncio
async def test_heygen_avatar_stage_persists_development_avatar_video(
    authenticated_client,
    app,
    monkeypatch,
):
    provider = CountingNarrationProvider()
    app.dependency_overrides[get_settings] = lambda: Settings(
        app_environment="development",
        script_generation_enabled=False,
        supabase_url="",
        supabase_service_role_key="",
        supabase_anon_key="",
        supabase_jwt_secret="test-secret",
        supabase_jwks_url="",
        elevenlabs_api_key="test-key",
        heygen_avatar_cost_per_second_usd=0.02,
    )
    monkeypatch.setattr(generations, "_narration_provider", lambda _settings: provider)
    try:
        instructor = await authenticated_client.post(
            "/api/v1/instructors",
            json={
                "displayName": "Avatar Instructor",
                "voiceId": "voice-avatar",
                "avatarId": "heygen-avatar",
                "imageZoom": 1,
                "imageX": 50,
                "imageY": 50,
            },
        )
        created = await authenticated_client.post(
            "/api/v1/generations",
            json={
                "equation": "x^2 + 5*x + 6 = 0",
                "instructorId": instructor.json()["id"],
            },
        )
        generation_id = created.json()["job"]["id"]
        await authenticated_client.post(
            f"/api/v1/generations/{generation_id}/stages/teacher_script",
            json={},
        )
        await authenticated_client.post(
            f"/api/v1/generations/{generation_id}/stages/elevenlabs_audio",
            json={},
        )

        response = await authenticated_client.post(
            f"/api/v1/generations/{generation_id}/stages/heygen_avatar",
            json={},
        )
        usage = await authenticated_client.get("/api/v1/usage/events")
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 200
    avatar_artifact = next(
        artifact
        for artifact in response.json()["artifacts"]
        if artifact["stage"] == "heygen_avatar"
    )
    assert avatar_artifact["status"] == "completed"
    assert avatar_artifact["payload"]["outputFormat"] == "webm"
    assert avatar_artifact["storageObjects"][0]["contentType"] == "video/webm"
    assert any(event["provider"] == "heygen" for event in usage.json()["events"])


@pytest.mark.asyncio
async def test_animation_plan_stage_records_provider_failure(
    authenticated_client,
    app,
    monkeypatch,
):
    provider = CountingNarrationProvider()
    app.dependency_overrides[get_settings] = lambda: Settings(
        script_generation_enabled=False,
        elevenlabs_api_key="test-key",
    )
    monkeypatch.setattr(generations, "_narration_provider", lambda _settings: provider)
    monkeypatch.setattr(
        generations,
        "_animation_plan_provider",
        lambda _settings: FailingAnimationPlanProvider(),
    )
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
        await authenticated_client.post(
            f"/api/v1/generations/{generation_id}/stages/elevenlabs_audio",
            json={},
        )

        response = await authenticated_client.post(
            f"/api/v1/generations/{generation_id}/stages/animation_plan",
            json={},
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 200
    plan_artifacts = [
        artifact
        for artifact in response.json()["artifacts"]
        if artifact["stage"] == "animation_plan"
    ]
    assert plan_artifacts[-1]["status"] == "failed"
    assert plan_artifacts[-1]["errorCode"] == "animation_plan_failed"
    assert "planner exploded" in plan_artifacts[-1]["errorMessage"]


@pytest.mark.asyncio
async def test_render_stage_records_media_storage_failure(
    authenticated_client,
    app,
    monkeypatch,
):
    provider = CountingNarrationProvider()
    app.dependency_overrides[get_settings] = lambda: Settings(
        script_generation_enabled=False,
        elevenlabs_api_key="test-key",
    )
    monkeypatch.setattr(generations, "_narration_provider", lambda _settings: provider)
    try:
        created = await authenticated_client.post(
            "/api/v1/generations",
            json={"equation": "x^2 + 5*x + 6 = 0"},
        )
        generation_id = created.json()["job"]["id"]
        await authenticated_client.post(f"/api/v1/generations/{generation_id}/run-all", json={})

        monkeypatch.setattr(
            generations,
            "_generation_services",
            lambda settings: (generations._solve_generations, FailingMediaStore()),
        )
        response = await authenticated_client.post(
            f"/api/v1/generations/{generation_id}/stages/motion_canvas_render",
            json={"force": True},
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 200
    render_artifacts = [
        artifact
        for artifact in response.json()["artifacts"]
        if artifact["stage"] == "motion_canvas_render"
    ]
    assert render_artifacts[-1]["status"] == "failed"
    assert render_artifacts[-1]["errorCode"] == "motion_canvas_render_failed"
    assert "media upload failed" in render_artifacts[-1]["errorMessage"]


@pytest.mark.asyncio
async def test_development_golden_equation_reuses_latest_generation_checkpoint(
    authenticated_client,
    app,
    monkeypatch,
):
    monkeypatch.setenv("APP_ENVIRONMENT", "development")
    app.dependency_overrides[get_settings] = lambda: Settings(
        app_environment="development",
        script_generation_enabled=False,
        supabase_url="",
        supabase_service_role_key="",
        supabase_anon_key="",
        supabase_jwt_secret="test-secret",
        supabase_jwks_url="",
    )
    try:
        first = await authenticated_client.post(
            "/api/v1/generations",
            json={"equation": "x^2 + 5*x + 6 = 0", "instructorId": "male"},
        )
        generation_id = first.json()["job"]["id"]
        scripted = await authenticated_client.post(
            f"/api/v1/generations/{generation_id}/stages/teacher_script",
            json={},
        )

        second = await authenticated_client.post(
            "/api/v1/generations",
            json={"equation": "x^2 + 5*x + 6", "instructorId": "male"},
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert first.status_code == 200
    assert scripted.status_code == 200
    assert second.status_code == 200
    assert second.json()["job"]["id"] == generation_id
    assert [artifact["stage"] for artifact in second.json()["artifacts"]] == [
        "solution",
        "lesson",
        "teacher_script",
    ]


@pytest.mark.asyncio
async def test_golden_equation_checkpoint_reuse_can_be_enabled_outside_development(
    authenticated_client,
    app,
):
    app.dependency_overrides[get_settings] = lambda: Settings(
        app_environment="production",
        golden_checkpoint_reuse_enabled=True,
        script_generation_enabled=False,
        supabase_url="",
        supabase_service_role_key="",
        supabase_anon_key="",
        supabase_jwt_secret="test-secret",
        supabase_jwks_url="",
    )
    try:
        first = await authenticated_client.post(
            "/api/v1/generations",
            json={"equation": "x^2 + 5*x + 6 = 0", "instructorId": "male"},
        )
        generation_id = first.json()["job"]["id"]
        scripted = await authenticated_client.post(
            f"/api/v1/generations/{generation_id}/stages/teacher_script",
            json={},
        )

        second = await authenticated_client.post(
            "/api/v1/generations",
            json={"equation": "x^2 + 5*x + 6", "instructorId": "male"},
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert first.status_code == 200
    assert scripted.status_code == 200
    assert second.status_code == 200
    assert second.json()["job"]["id"] == generation_id
    assert [artifact["stage"] for artifact in second.json()["artifacts"]] == [
        "solution",
        "lesson",
        "teacher_script",
    ]


@pytest.mark.asyncio
async def test_development_checkpoint_reuse_is_limited_to_golden_equation(
    authenticated_client,
    app,
    monkeypatch,
):
    monkeypatch.setenv("APP_ENVIRONMENT", "development")
    app.dependency_overrides[get_settings] = lambda: Settings(
        app_environment="development",
        script_generation_enabled=False,
        supabase_url="",
        supabase_service_role_key="",
        supabase_anon_key="",
        supabase_jwt_secret="test-secret",
        supabase_jwks_url="",
    )
    try:
        first = await authenticated_client.post(
            "/api/v1/generations",
            json={"equation": "x^2 - x = 0", "instructorId": "male"},
        )
        second = await authenticated_client.post(
            "/api/v1/generations",
            json={"equation": "x^2 - x = 0", "instructorId": "male"},
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["job"]["id"] != first.json()["job"]["id"]
