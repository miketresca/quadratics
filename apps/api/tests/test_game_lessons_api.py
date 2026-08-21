import pytest

from app.api.routes import game_lessons
from app.core.config import Settings
from app.schemas.game_lessons import GameLessonRunStageRequest
from app.schemas.instructor import Instructor
from app.services.game_lessons.providers import GameLessonProviderRuntimeError
from app.services.game_lessons.repository import InMemoryGameLessonRepository
from app.services.instructors.repository import InstructorStorageError


class _ProviderFailureGameLessonRepository(InMemoryGameLessonRepository):
    async def run_stage(
        self,
        user_id: str,
        run_id: str,
        stage: str,
        request: GameLessonRunStageRequest,
    ):
        if stage == "narration":
            raise GameLessonProviderRuntimeError(
                "Narration failed while generating ElevenLabs audio for section 'do_now': "
                "ElevenLabs payment is required or the account has insufficient credits.",
                provider="elevenlabs",
                stage="narration",
                status_code=402,
                upstream_status_code=402,
            )
        return await super().run_stage(user_id, run_id, stage, request)  # type: ignore[arg-type]


class _AliasFallbackInstructorRepository:
    async def get(self, instructor_id: str | None) -> Instructor | None:
        if instructor_id == "male":
            raise InstructorStorageError("Instructor storage request failed: 400")
        return None

    async def list(self) -> list[Instructor]:
        return [
            Instructor(
                id="7f64f9f0-4ec5-46fb-9f9d-6c90f9e3d13f",
                display_name="Male Instructor",
                voice_id="real-male-voice",
            )
        ]


@pytest.fixture(autouse=True)
def reset_game_lesson_repository():
    game_lessons._game_lessons = InMemoryGameLessonRepository()
    yield
    game_lessons._game_lessons = None


@pytest.mark.asyncio
async def test_game_lessons_rejects_unauthenticated(client):
    response = await client.post(
        "/api/v1/game/lessons/volume-cubes-lesson-1/runs",
        json={},
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_game_lessons_create_or_reuse_run(authenticated_client):
    first = await authenticated_client.post(
        "/api/v1/game/lessons/volume-cubes-lesson-1/runs",
        json={"selectedInstructorId": "male"},
    )
    second = await authenticated_client.post(
        "/api/v1/game/lessons/volume-cubes-lesson-1/runs",
        json={"selectedInstructorId": "male"},
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    assert [section["id"] for section in first.json()["template"]["payload"]["sections"]] == [
        "do_now",
        "vocabulary",
        "guided_practice",
    ]


@pytest.mark.asyncio
async def test_game_lessons_run_template_stage(authenticated_client):
    created = await authenticated_client.post(
        "/api/v1/game/lessons/volume-cubes-lesson-1/runs",
        json={},
    )

    response = await authenticated_client.post(
        f"/api/v1/game/lesson-runs/{created.json()['id']}/stages/template",
        json={},
    )

    assert response.status_code == 200
    artifacts = response.json()["artifacts"]
    assert artifacts[0]["stage"] == "template"
    assert artifacts[0]["version"] == 1
    assert artifacts[0]["status"] == "completed"


@pytest.mark.asyncio
async def test_game_lessons_rejects_unknown_stage(authenticated_client):
    created = await authenticated_client.post(
        "/api/v1/game/lessons/volume-cubes-lesson-1/runs",
        json={},
    )

    response = await authenticated_client.post(
        f"/api/v1/game/lesson-runs/{created.json()['id']}/stages/not_a_stage",
        json={},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Unknown game lesson stage"


@pytest.mark.asyncio
async def test_game_lessons_runs_section_script_stage(authenticated_client):
    created = await authenticated_client.post(
        "/api/v1/game/lessons/volume-cubes-lesson-1/runs",
        json={},
    )
    await authenticated_client.post(
        f"/api/v1/game/lesson-runs/{created.json()['id']}/stages/template",
        json={},
    )

    response = await authenticated_client.post(
        f"/api/v1/game/lesson-runs/{created.json()['id']}/stages/section_script",
        json={},
    )

    assert response.status_code == 200
    artifact = response.json()["artifacts"][1]
    assert artifact["stage"] == "section_script"
    assert artifact["status"] == "awaiting_approval"


@pytest.mark.asyncio
async def test_game_lessons_returns_provider_stage_failures(authenticated_client):
    game_lessons._game_lessons = _ProviderFailureGameLessonRepository()
    created = await authenticated_client.post(
        "/api/v1/game/lessons/volume-cubes-lesson-1/runs",
        json={},
    )

    response = await authenticated_client.post(
        f"/api/v1/game/lesson-runs/{created.json()['id']}/stages/narration",
        json={},
    )

    assert response.status_code == 402
    assert response.json()["detail"] == (
        "Narration failed while generating ElevenLabs audio for section 'do_now': "
        "ElevenLabs payment is required or the account has insufficient credits."
    )


@pytest.mark.asyncio
async def test_game_lesson_voice_lookup_falls_back_from_default_alias(monkeypatch):
    monkeypatch.setattr(
        game_lessons,
        "_instructor_repository",
        lambda settings: _AliasFallbackInstructorRepository(),
    )

    voice_id = await game_lessons._voice_id_for_instructor(Settings(), "male")

    assert voice_id == "real-male-voice"


@pytest.mark.asyncio
async def test_game_lessons_approve_template_artifact(authenticated_client):
    created = await authenticated_client.post(
        "/api/v1/game/lessons/volume-cubes-lesson-1/runs",
        json={},
    )
    staged = await authenticated_client.post(
        f"/api/v1/game/lesson-runs/{created.json()['id']}/stages/template",
        json={},
    )
    artifact_id = staged.json()["artifacts"][0]["id"]

    response = await authenticated_client.post(
        f"/api/v1/game/artifacts/{artifact_id}/approve",
        json={"decision": "approved", "notes": "Looks good"},
    )

    assert response.status_code == 200
    assert response.json()["artifactId"] == artifact_id
    assert response.json()["decision"] == "approved"
