import pytest

from app.api.routes import game_lessons
from app.services.game_lessons.repository import InMemoryGameLessonRepository


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
    assert first.json()["template"]["payload"]["sections"] == [
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
async def test_game_lessons_blocks_downstream_provider_stage(authenticated_client):
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

    assert response.status_code == 409
    assert "approval-gated provider stages" in response.json()["detail"]


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
