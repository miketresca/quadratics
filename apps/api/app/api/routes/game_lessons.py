from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies.auth import get_current_user
from app.core.config import Settings, get_settings
from app.core.security import AuthenticatedUser
from app.schemas.game_lessons import (
    GameLessonArtifactApproval,
    GameLessonArtifactApprovalRequest,
    GameLessonRunStageRequest,
    GameWorksheetRunCreateRequest,
    GameWorksheetRunSnapshot,
)
from app.services.game_lessons.repository import (
    GameLessonArtifactNotFound,
    GameLessonRepository,
    GameLessonRunNotFound,
    GameLessonStageBlocked,
    GameLessonStorageError,
    GameLessonTemplateNotFound,
    InMemoryGameLessonRepository,
    SupabaseGameLessonRepository,
)
from app.services.game_lessons.costs import (
    InMemoryGameUsageCostRepository,
    SupabaseGameUsageCostRepository,
)
from app.services.game_lessons.providers import (
    GameLessonProviderConfigurationError,
    OpenAIGameLessonStageProvider,
)

router = APIRouter(prefix="/game")
_game_lessons: GameLessonRepository | None = None
_fallback_game_lessons = InMemoryGameLessonRepository()
_fallback_game_usage_costs = InMemoryGameUsageCostRepository()


@router.post("/lessons/{template_id}/runs", response_model=GameWorksheetRunSnapshot)
async def create_game_lesson_run(
    template_id: str,
    request: GameWorksheetRunCreateRequest,
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> GameWorksheetRunSnapshot:
    try:
        return await _repository(settings).create_or_get_run(current_user.id, template_id, request)
    except GameLessonTemplateNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except GameLessonProviderConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except GameLessonStorageError as exc:
        raise _storage_http_error(exc) from exc


@router.get("/lesson-runs/{run_id}", response_model=GameWorksheetRunSnapshot)
async def get_game_lesson_run(
    run_id: str,
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> GameWorksheetRunSnapshot:
    try:
        return await _repository(settings).get_run(current_user.id, run_id)
    except GameLessonRunNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except GameLessonProviderConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except GameLessonStorageError as exc:
        raise _storage_http_error(exc) from exc


@router.post("/lesson-runs/{run_id}/stages/{stage}", response_model=GameWorksheetRunSnapshot)
async def run_game_lesson_stage(
    run_id: str,
    stage: str,
    request: GameLessonRunStageRequest,
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> GameWorksheetRunSnapshot:
    try:
        return await _repository(settings).run_stage(
            current_user.id,
            run_id,
            stage,  # type: ignore[arg-type]
            request,
        )
    except GameLessonRunNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except GameLessonStageBlocked as exc:
        message = str(exc)
        status_code = (
            status.HTTP_400_BAD_REQUEST
            if message == "Unknown game lesson stage"
            else status.HTTP_409_CONFLICT
        )
        raise HTTPException(status_code=status_code, detail=message) from exc
    except GameLessonProviderConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except GameLessonStorageError as exc:
        raise _storage_http_error(exc) from exc


@router.post("/artifacts/{artifact_id}/approve", response_model=GameLessonArtifactApproval)
async def approve_game_lesson_artifact(
    artifact_id: str,
    request: GameLessonArtifactApprovalRequest,
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> GameLessonArtifactApproval:
    try:
        return await _repository(settings).approve_artifact(current_user.id, artifact_id, request)
    except GameLessonArtifactNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except GameLessonRunNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except GameLessonStageBlocked as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except GameLessonProviderConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except GameLessonStorageError as exc:
        raise _storage_http_error(exc) from exc


def _repository(settings: Settings) -> GameLessonRepository:
    if _game_lessons is not None:
        return _game_lessons
    if settings.supabase_url and settings.supabase_service_role_key:
        return SupabaseGameLessonRepository(
            settings,
            stage_provider=_stage_provider(settings),
            usage_costs=_usage_repository(settings),
        )
    return _fallback_game_lessons


def _stage_provider(settings: Settings) -> OpenAIGameLessonStageProvider | None:
    if not settings.script_generation_enabled or not settings.openai_api_key:
        return None
    return OpenAIGameLessonStageProvider(
        api_key=settings.openai_api_key,
        model=settings.openai_script_model,
        input_token_cost_per_million_usd=settings.openai_gpt5_mini_input_cost_per_million_tokens_usd,
        output_token_cost_per_million_usd=settings.openai_gpt5_mini_output_cost_per_million_tokens_usd,
    )


def _usage_repository(settings: Settings) -> InMemoryGameUsageCostRepository | SupabaseGameUsageCostRepository:
    if settings.supabase_url and settings.supabase_service_role_key:
        return SupabaseGameUsageCostRepository(settings)
    return _fallback_game_usage_costs


def _storage_http_error(exc: GameLessonStorageError) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=str(exc),
    )
