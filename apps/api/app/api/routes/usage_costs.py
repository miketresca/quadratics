from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies.auth import get_current_user
from app.core.config import Settings, get_settings
from app.core.security import AuthenticatedUser
from app.schemas.usage_costs import UsageSummary
from app.services.usage.costs import (
    InMemoryUsageCostRepository,
    SupabaseUsageCostRepository,
    UsageCostStorageError,
)

router = APIRouter(prefix="/usage")

_usage_costs = InMemoryUsageCostRepository()


@router.get("/summary", response_model=UsageSummary)
async def get_usage_summary(
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> UsageSummary:
    try:
        return await _usage_repository(settings).summary(current_user.id)
    except UsageCostStorageError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def _usage_repository(
    settings: Settings,
) -> InMemoryUsageCostRepository | SupabaseUsageCostRepository:
    if settings.app_environment == "test":
        return _usage_costs
    if settings.supabase_url and settings.supabase_service_role_key:
        return SupabaseUsageCostRepository(settings)
    return _usage_costs
