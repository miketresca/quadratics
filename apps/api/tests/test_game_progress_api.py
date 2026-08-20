import pytest

from app.api.routes import game_progress
from app.services.game.progress import InMemoryGameProgressRepository


@pytest.fixture(autouse=True)
def reset_game_progress_repository():
    game_progress._progress = InMemoryGameProgressRepository()
    yield
    game_progress._progress = None


@pytest.mark.asyncio
async def test_game_progress_rejects_unauthenticated(client):
    response = await client.get("/api/v1/game/me/progress")

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_game_progress_selects_and_persists_fighter(authenticated_client):
    selected = await authenticated_client.put(
        "/api/v1/game/me/progress",
        json={"action": "select_fighter", "selectedFighterId": "luigi"},
    )
    loaded = await authenticated_client.get("/api/v1/game/me/progress")

    assert selected.status_code == 200
    assert selected.json()["selectedFighterId"] == "luigi"
    assert loaded.status_code == 200
    assert loaded.json()["selectedFighterId"] == "luigi"


@pytest.mark.asyncio
async def test_game_progress_rejects_locked_lesson_completion(authenticated_client):
    response = await authenticated_client.put(
        "/api/v1/game/me/progress",
        json={"action": "complete_lesson", "lessonId": "dynamic-lesson-locked"},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Lesson is locked"


@pytest.mark.asyncio
async def test_game_progress_rejects_invalid_fighter(authenticated_client):
    response = await authenticated_client.put(
        "/api/v1/game/me/progress",
        json={"action": "select_fighter", "selectedFighterId": "unknown"},
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_game_progress_starts_completes_and_resets_lesson(authenticated_client):
    started = await authenticated_client.put(
        "/api/v1/game/me/progress",
        json={"action": "start_lesson", "lessonId": "volume-cubes-lesson-1"},
    )
    completed = await authenticated_client.put(
        "/api/v1/game/me/progress",
        json={"action": "complete_lesson", "lessonId": "volume-cubes-lesson-1"},
    )
    reset = await authenticated_client.post("/api/v1/game/me/progress/reset")

    assert started.status_code == 200
    assert started.json()["lessons"][0]["status"] == "started"
    assert completed.status_code == 200
    assert completed.json()["lessons"][0]["status"] == "completed"
    assert completed.json()["lessons"][0]["completedAt"] is not None
    assert reset.status_code == 200
    assert reset.json() == {"selectedFighterId": None, "lessons": []}
