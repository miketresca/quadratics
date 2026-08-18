from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.api.dependencies.auth import get_current_user
from app.core.config import Settings, get_settings
from app.core.security import AuthenticatedUser
from app.schemas.provider_keys import (
    ProviderKeyMetadata,
    ProviderKeyName,
    ProviderKeysResponse,
    ProviderKeyUpsertRequest,
)
from app.services.provider_keys.storage import ProviderKeyStorageError, SupabaseProviderKeyStore

router = APIRouter(prefix="/provider-keys")


@router.get("", response_model=ProviderKeysResponse)
async def list_provider_keys(
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ProviderKeysResponse:
    store = _store(settings)
    try:
        return ProviderKeysResponse(keys=await store.list_metadata(current_user.id))
    except ProviderKeyStorageError as exc:
        raise _storage_http_error(exc) from exc


@router.put("/{provider}", response_model=ProviderKeyMetadata)
async def upsert_provider_key(
    provider: ProviderKeyName,
    request: ProviderKeyUpsertRequest,
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ProviderKeyMetadata:
    if provider != request.provider:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provider mismatch")
    store = _store(settings)
    try:
        return await store.upsert(
            user_id=current_user.id,
            provider=request.provider,
            api_key=request.api_key,
        )
    except ProviderKeyStorageError as exc:
        raise _storage_http_error(exc) from exc


@router.delete("/{provider}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider_key(
    provider: ProviderKeyName,
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> Response:
    store = _store(settings)
    try:
        await store.delete(current_user.id, provider)
    except ProviderKeyStorageError as exc:
        raise _storage_http_error(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _store(settings: Settings) -> SupabaseProviderKeyStore:
    try:
        return SupabaseProviderKeyStore(settings)
    except ProviderKeyStorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc


def _storage_http_error(exc: ProviderKeyStorageError) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=str(exc),
    )
