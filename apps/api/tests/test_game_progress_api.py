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
async def test_game_progress_rejects_lesson_completion_before_start(authenticated_client):
    response = await authenticated_client.put(
        "/api/v1/game/me/progress",
        json={"action": "complete_lesson", "lessonId": "volume-cubes-lesson-1"},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Lesson has not been started"


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


@pytest.mark.asyncio
async def test_game_progress_persists_worksheet_playback_metadata(authenticated_client):
    await authenticated_client.put(
        "/api/v1/game/me/progress",
        json={"action": "start_lesson", "lessonId": "volume-cubes-lesson-1"},
    )

    updated = await authenticated_client.put(
        "/api/v1/game/me/progress",
        json={
            "action": "update_lesson_playback",
            "lessonId": "volume-cubes-lesson-1",
            "worksheetPlayback": {
                "completedSectionIds": ["do_now", "vocabulary"],
                "currentPageId": "page_2",
                "lessonCompletedAt": 1770000000000,
            },
        },
    )
    completed = await authenticated_client.put(
        "/api/v1/game/me/progress",
        json={"action": "complete_lesson", "lessonId": "volume-cubes-lesson-1"},
    )

    assert updated.status_code == 200
    metadata = updated.json()["lessons"][0]["metadata"]
    assert metadata["worksheetPlayback"]["completedSectionIds"] == ["do_now", "vocabulary"]
    assert metadata["worksheetPlayback"]["currentPageId"] == "page_2"
    assert completed.status_code == 200
    assert completed.json()["lessons"][0]["metadata"] == metadata


@pytest.mark.asyncio
async def test_game_progress_persists_reward_and_easter_metadata(authenticated_client):
    await authenticated_client.put(
        "/api/v1/game/me/progress",
        json={"action": "start_lesson", "lessonId": "volume-cubes-lesson-1"},
    )

    reward = await authenticated_client.put(
        "/api/v1/game/me/progress",
        json={"action": "set_phone_reward", "lessonId": "volume-cubes-lesson-1"},
    )
    egg = await authenticated_client.put(
        "/api/v1/game/me/progress",
        json={"action": "claim_easter_egg", "lessonId": "volume-cubes-lesson-1", "easterEggId": "lesson_1_phone_reward"},
    )
    cleared = await authenticated_client.put(
        "/api/v1/game/me/progress",
        json={"action": "clear_phone_reward", "lessonId": "volume-cubes-lesson-1"},
    )

    assert reward.status_code == 200
    assert reward.json()["lessons"][0]["metadata"]["phoneRewardPending"] is True
    assert egg.status_code == 200
    assert egg.json()["lessons"][0]["metadata"]["easterEggs"] == {
        "discoveredIds": ["lesson_1_phone_reward"],
        "total": 1,
    }
    assert cleared.status_code == 200
    assert cleared.json()["lessons"][0]["metadata"]["phoneRewardPending"] is False
    assert cleared.json()["lessons"][0]["metadata"]["easterEggs"]["discoveredIds"] == ["lesson_1_phone_reward"]
