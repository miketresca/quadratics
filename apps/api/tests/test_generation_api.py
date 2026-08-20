import pytest

from app.api.routes import generations
from app.core.config import Settings, get_settings
from app.providers.heygen.avatar_provider import HeyGenAvatarVideoProvider
from app.schemas.narration import AudioAlignment
from app.services.animation.base import AnimationPlanningRequest, AnimationPlanProvider
from app.services.artifacts import InMemoryArtifactRepository
from app.services.avatars.development import DevelopmentAvatarVideoProvider
from app.services.context.base import RealWorldContextProvider, RealWorldContextRequest
from app.services.jobs.generation_jobs import InMemoryGenerationJobRepository
from app.services.narration.base import NarrationProvider, NarrationRequest, NarrationResult
from app.services.pipeline.solve_snapshot import SolveGenerationService
from app.services.storage.media_store import MediaStore


class FailingAnimationPlanProvider(AnimationPlanProvider):
    async def generate_animation_plan(self, request: AnimationPlanningRequest):
        raise RuntimeError("planner exploded")


class FailingRealWorldContextProvider(RealWorldContextProvider):
    async def generate(self, request: RealWorldContextRequest):
        raise RuntimeError("context exploded")


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


@pytest.mark.asyncio
async def test_avatar_provider_uses_development_provider_in_tests():
    provider = await generations._avatar_provider(
        Settings(app_environment="test"),
        user_id="user-1",
    )

    assert isinstance(provider, DevelopmentAvatarVideoProvider)


@pytest.mark.asyncio
async def test_avatar_provider_uses_development_provider_without_dev_key():
    provider = await generations._avatar_provider(
        Settings(app_environment="development"),
        user_id="user-1",
    )

    assert isinstance(provider, DevelopmentAvatarVideoProvider)


@pytest.mark.asyncio
async def test_avatar_provider_uses_heygen_provider_with_server_key_in_development():
    provider = await generations._avatar_provider(
        Settings(app_environment="development", heygen_api_key="test-heygen-key"),
        user_id="user-1",
    )

    assert isinstance(provider, HeyGenAvatarVideoProvider)


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
async def test_real_world_context_stage_persists_optional_lesson_context(
    authenticated_client,
    app,
):
    app.dependency_overrides[get_settings] = lambda: Settings(
        app_environment="test",
        script_generation_enabled=False,
    )
    try:
        created = await authenticated_client.post(
            "/api/v1/generations",
            json={"equation": "x^2 + 5*x + 6 = 0"},
        )
        generation_id = created.json()["job"]["id"]

        response = await authenticated_client.post(
            f"/api/v1/generations/{generation_id}/stages/real_world_context",
            json={},
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 200
    context_artifact = next(
        artifact
        for artifact in response.json()["artifacts"]
        if artifact["stage"] == "real_world_context"
    )
    assert context_artifact["status"] == "completed"
    assert context_artifact["payload"]["status"] == "completed"
    assert context_artifact["payload"]["title"]
    assert context_artifact["configMetadata"] == {"optionalLessonEnrichment": True}


@pytest.mark.asyncio
async def test_real_world_context_stage_persists_failed_context_payload(
    authenticated_client,
    app,
    monkeypatch,
):
    app.dependency_overrides[get_settings] = lambda: Settings(
        app_environment="test",
        script_generation_enabled=True,
        openai_api_key="test-key",
    )
    monkeypatch.setattr(
        generations,
        "_real_world_context_provider",
        lambda _settings: FailingRealWorldContextProvider(),
    )
    try:
        created = await authenticated_client.post(
            "/api/v1/generations",
            json={"equation": "x^2 + 5*x + 6 = 0"},
        )
        generation_id = created.json()["job"]["id"]

        response = await authenticated_client.post(
            f"/api/v1/generations/{generation_id}/stages/real_world_context",
            json={},
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 200
    context_artifact = next(
        artifact
        for artifact in response.json()["artifacts"]
        if artifact["stage"] == "real_world_context"
    )
    assert context_artifact["status"] == "failed"
    assert context_artifact["errorCode"] == "real_world_context_failed"
    assert context_artifact["payload"] == {
        "status": "failed",
        "title": "",
        "scenario": "",
        "takeaway": "",
        "unsupportedReason": "context exploded",
        "providerMetadata": {},
    }


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
        heygen_avatar_iv_cost_per_second_usd=0.02,
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
            json={"avatarModel": "avatar_iv"},
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
    assert avatar_artifact["model"] == "avatar_iv"
    assert avatar_artifact["payload"]["avatarModel"] == "avatar_iv"
    assert avatar_artifact["payload"]["outputFormat"] == "webm"
    assert avatar_artifact["payload"]["segmentCount"] == 3
    assert len(avatar_artifact["storageObjects"]) == 3
    assert all(
        storage_object["contentType"] == "video/webm"
        for storage_object in avatar_artifact["storageObjects"]
    )
    heygen_event = next(event for event in usage.json()["events"] if event["provider"] == "heygen")
    assert heygen_event["model"] == "avatar_iv"
    assert heygen_event["quantity"] == pytest.approx(3.6)
    assert heygen_event["costUsd"] == pytest.approx(0.072)


@pytest.mark.asyncio
async def test_render_stage_requires_explicit_avatar_inclusion(
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
        for stage in [
            "teacher_script",
            "elevenlabs_audio",
            "heygen_avatar",
            "animation_plan",
            "resolved_timeline",
        ]:
            await authenticated_client.post(
                f"/api/v1/generations/{generation_id}/stages/{stage}",
                json={},
            )

        without_avatar = await authenticated_client.post(
            f"/api/v1/generations/{generation_id}/stages/motion_canvas_render",
            json={"includeAvatar": False},
        )
        with_avatar = await authenticated_client.post(
            f"/api/v1/generations/{generation_id}/stages/motion_canvas_render",
            json={"includeAvatar": True, "force": True},
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert without_avatar.status_code == 200
    render_without_avatar = [
        artifact
        for artifact in without_avatar.json()["artifacts"]
        if artifact["stage"] == "motion_canvas_render"
    ][-1]
    assert render_without_avatar["payload"]["includeAvatar"] is False
    assert "avatarArtifactId" not in render_without_avatar["payload"]

    assert with_avatar.status_code == 200
    render_with_avatar = [
        artifact
        for artifact in with_avatar.json()["artifacts"]
        if artifact["stage"] == "motion_canvas_render"
    ][-1]
    assert render_with_avatar["payload"]["includeAvatar"] is True
    assert render_with_avatar["payload"]["avatarArtifactId"]


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
async def test_generation_create_reuses_latest_matching_user_equation_and_instructor(
    authenticated_client,
    app,
    monkeypatch,
):
    monkeypatch.setenv("APP_ENVIRONMENT", "production")
    app.dependency_overrides[get_settings] = lambda: Settings(
        app_environment="production",
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
            json={"equation": "2*x^2 - 7*x + 3 = 0", "instructorId": "male"},
        )
        generation_id = first.json()["job"]["id"]
        scripted = await authenticated_client.post(
            f"/api/v1/generations/{generation_id}/stages/teacher_script",
            json={},
        )

        second = await authenticated_client.post(
            "/api/v1/generations",
            json={"equation": "2*x^2 - 7*x + 3", "instructorId": "male"},
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
async def test_generation_reuse_is_scoped_to_instructor(
    authenticated_client,
    app,
):
    app.dependency_overrides[get_settings] = lambda: Settings(
        app_environment="production",
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
        second = await authenticated_client.post(
            "/api/v1/generations",
            json={"equation": "x^2 + 5*x + 6", "instructorId": "female"},
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["job"]["id"] != first.json()["job"]["id"]


@pytest.mark.asyncio
async def test_generation_reuse_is_not_shared_between_users(
    monkeypatch,
):
    monkeypatch.setenv("APP_ENVIRONMENT", "production")
    service = SolveGenerationService(
        jobs=InMemoryGenerationJobRepository(),
        artifacts=InMemoryArtifactRepository(),
    )

    first = service.create_generation(
        user_id="00000000-0000-0000-0000-000000000001",
        equation="x^2 - x = 0",
        instructor_id="male",
    )
    second = service.create_generation(
        user_id="00000000-0000-0000-0000-000000000002",
        equation="x^2 - x = 0",
        instructor_id="male",
    )

    assert second.job.id != first.job.id
