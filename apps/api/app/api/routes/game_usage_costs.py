from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.dependencies.auth import get_current_user
from app.core.config import Settings, get_settings
from app.core.security import AuthenticatedUser
from app.schemas.game_usage_costs import GameUsageEventsResponse, GameUsageSummary
from app.services.game_lessons.costs import (
    GameUsageCostRepository,
    GameUsageCostStorageError,
    InMemoryGameUsageCostRepository,
    SupabaseGameUsageCostRepository,
)

router = APIRouter(prefix="/game/usage")
_game_usage_costs: GameUsageCostRepository | None = None
_fallback_game_usage_costs = InMemoryGameUsageCostRepository()


@router.get("/summary", response_model=GameUsageSummary)
async def get_game_usage_summary(
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> GameUsageSummary:
    try:
        return await _repository(settings).summary(current_user.id)
    except GameUsageCostStorageError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/events", response_model=GameUsageEventsResponse)
async def get_game_usage_events(
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> GameUsageEventsResponse:
    try:
        events = await _repository(settings).events(current_user.id, limit=limit)
        return GameUsageEventsResponse(events=events)
    except GameUsageCostStorageError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def _repository(settings: Settings) -> GameUsageCostRepository:
    if _game_usage_costs is not None:
        return _game_usage_costs
    if settings.app_environment == "test":
        return _fallback_game_usage_costs
    if settings.supabase_url and settings.supabase_service_role_key:
        return SupabaseGameUsageCostRepository(settings)
    return _fallback_game_usage_costs
