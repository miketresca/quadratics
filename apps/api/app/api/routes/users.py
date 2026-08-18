from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.dependencies.auth import get_current_user
from app.core.config import Settings, get_settings
from app.core.security import AuthenticatedUser
from app.schemas.user import CurrentUserResponse
from app.services.usage.credits import credit_ledger
from app.services.users.provisioning import profile_store

router = APIRouter()


@router.get("/me", response_model=CurrentUserResponse)
async def me(
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> CurrentUserResponse:
    profile = profile_store.ensure_profile(current_user, settings.default_generation_credits)
    return CurrentUserResponse(
        id=profile.id,
        email=profile.email,
        display_name=profile.display_name,
        credit_balance=credit_ledger.balance_for_user(profile.id),
    )
