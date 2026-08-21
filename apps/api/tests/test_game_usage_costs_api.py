import pytest

from app.api.routes import game_usage_costs
from app.services.game_lessons.costs import InMemoryGameUsageCostRepository


@pytest.fixture(autouse=True)
def reset_game_usage_repository():
    game_usage_costs._game_usage_costs = InMemoryGameUsageCostRepository()
    yield
    game_usage_costs._game_usage_costs = None


@pytest.mark.asyncio
async def test_game_usage_rejects_unauthenticated(client):
    response = await client.get("/api/v1/game/usage/summary")

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_game_usage_summary_tracks_user_spend_without_partial_average(authenticated_client):
    repository = game_usage_costs._game_usage_costs
    assert isinstance(repository, InMemoryGameUsageCostRepository)
    await repository.record(
        user_id="00000000-0000-0000-0000-000000000001",
        run_id="run-partial",
        artifact_id="artifact-1",
        stage="section_script",
        provider="openai",
        model="gpt-5-mini",
        unit_type="output_tokens",
        quantity=1000,
        unit_cost_usd=0.000001,
    )

    response = await authenticated_client.get("/api/v1/game/usage/summary")

    assert response.status_code == 200
    body = response.json()
    assert body["userTotalCostUsd"] == pytest.approx(0.001)
    assert body["globalAverageCostPerLessonUsd"] == 0
    assert body["globalCompletedLessonCount"] == 0


@pytest.mark.asyncio
async def test_game_usage_summary_averages_completed_worksheet_runs(authenticated_client):
    repository = game_usage_costs._game_usage_costs
    assert isinstance(repository, InMemoryGameUsageCostRepository)
    await repository.record(
        user_id="00000000-0000-0000-0000-000000000001",
        run_id="run-one",
        artifact_id="artifact-1",
        stage="section_script",
        provider="openai",
        model="gpt-5-mini",
        unit_type="tokens",
        quantity=100,
        unit_cost_usd=0.01,
    )
    await repository.record(
        user_id="00000000-0000-0000-0000-000000000001",
        run_id="run-one",
        artifact_id="artifact-2",
        stage="narration",
        provider="elevenlabs",
        model="eleven_multilingual_v2",
        unit_type="credits",
        quantity=200,
        unit_cost_usd=0.01,
    )
    await repository.record(
        user_id="00000000-0000-0000-0000-000000000002",
        run_id="run-two",
        artifact_id="artifact-3",
        stage="narration",
        provider="elevenlabs",
        model="eleven_multilingual_v2",
        unit_type="credits",
        quantity=50,
        unit_cost_usd=0.01,
    )
    repository.mark_completed_run("run-one")
    repository.mark_completed_run("run-two")

    response = await authenticated_client.get("/api/v1/game/usage/summary")

    assert response.status_code == 200
    body = response.json()
    assert body["userTotalCostUsd"] == pytest.approx(3.0)
    assert body["globalAverageCostPerLessonUsd"] == pytest.approx(1.75)
    assert body["globalCompletedLessonCount"] == 2


@pytest.mark.asyncio
async def test_game_usage_events_are_user_scoped(authenticated_client):
    repository = game_usage_costs._game_usage_costs
    assert isinstance(repository, InMemoryGameUsageCostRepository)
    own_event = await repository.record(
        user_id="00000000-0000-0000-0000-000000000001",
        run_id="run-one",
        artifact_id="artifact-1",
        stage="narration",
        provider="elevenlabs",
        model="eleven_multilingual_v2",
        unit_type="credits",
        quantity=10,
        unit_cost_usd=0.01,
    )
    await repository.record(
        user_id="00000000-0000-0000-0000-000000000002",
        run_id="run-two",
        artifact_id="artifact-2",
        stage="narration",
        provider="elevenlabs",
        model="eleven_multilingual_v2",
        unit_type="credits",
        quantity=20,
        unit_cost_usd=0.01,
    )

    response = await authenticated_client.get("/api/v1/game/usage/events")

    assert response.status_code == 200
    assert [event["id"] for event in response.json()["events"]] == [own_event.id]
