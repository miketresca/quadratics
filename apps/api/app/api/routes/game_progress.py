from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies.auth import get_current_user
from app.core.config import Settings, get_settings
from app.core.security import AuthenticatedUser
from app.schemas.game import GameProgress, GameProgressUpdateRequest
from app.services.game.progress import (
    GameProgressRepository,
    GameProgressStorageError,
    InMemoryGameProgressRepository,
    InvalidGameProgressAction,
    SupabaseGameProgressRepository,
)

router = APIRouter(prefix="/game/me/progress")
_progress: GameProgressRepository | None = None
_fallback_progress = InMemoryGameProgressRepository()


@router.get("", response_model=GameProgress)
async def get_game_progress(
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> GameProgress:
    try:
        return await _repository(settings).get(current_user.id)
    except GameProgressStorageError as exc:
        raise _storage_http_error(exc) from exc


@router.put("", response_model=GameProgress)
async def update_game_progress(
    request: GameProgressUpdateRequest,
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> GameProgress:
    repository = _repository(settings)
    try:
        if request.action == "select_fighter":
            if request.selected_fighter_id is None:
                raise InvalidGameProgressAction("selectedFighterId is required")
            return await repository.select_fighter(current_user.id, request.selected_fighter_id)
        if request.action == "start_lesson":
            if request.lesson_id is None:
                raise InvalidGameProgressAction("lessonId is required")
            return await repository.start_lesson(current_user.id, request.lesson_id)
        if request.action == "complete_lesson":
            if request.lesson_id is None:
                raise InvalidGameProgressAction("lessonId is required")
            return await repository.complete_lesson(current_user.id, request.lesson_id)
    except InvalidGameProgressAction as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except GameProgressStorageError as exc:
        raise _storage_http_error(exc) from exc

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported game progress action")


@router.post("/reset", response_model=GameProgress)
async def reset_game_progress(
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> GameProgress:
    try:
        return await _repository(settings).reset(current_user.id)
    except GameProgressStorageError as exc:
        raise _storage_http_error(exc) from exc


def _repository(settings: Settings) -> GameProgressRepository:
    if _progress is not None:
        return _progress
    if settings.supabase_url and settings.supabase_service_role_key:
        return SupabaseGameProgressRepository(settings)
    return _fallback_progress


def _storage_http_error(exc: GameProgressStorageError) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=str(exc),
    )
