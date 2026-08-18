from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx
import jwt
from fastapi import HTTPException, status
from jwt import PyJWKClient

from app.core.config import Settings


@dataclass(frozen=True)
class AuthenticatedUser:
    id: str
    email: str | None = None


def _payload_to_user(payload: dict[str, Any]) -> AuthenticatedUser:
    subject = payload.get("sub")
    if not isinstance(subject, str) or not subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
        )
    email = payload.get("email")
    return AuthenticatedUser(id=subject, email=email if isinstance(email, str) else None)


async def verify_supabase_token(token: str, settings: Settings) -> AuthenticatedUser:
    if settings.dev_auth_bypass and token == "dev":
        return AuthenticatedUser(id=settings.dev_auth_user_id, email=settings.dev_auth_email)

    if settings.supabase_jwks_url:
        jwk_client = PyJWKClient(settings.supabase_jwks_url)
        signing_key = await _get_signing_key(jwk_client, token)
        try:
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "ES256"],
                options={"verify_aud": False},
            )
        except jwt.PyJWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            ) from exc
        return _payload_to_user(payload)

    if settings.supabase_jwt_secret:
        try:
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
        except jwt.PyJWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            ) from exc
        return _payload_to_user(payload)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Supabase JWT verification is not configured",
    )


async def _get_signing_key(jwk_client: PyJWKClient, token: str) -> Any:
    # PyJWKClient is synchronous; isolate the call for replacement if needed.
    try:
        return jwk_client.get_signing_key_from_jwt(token)
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="JWKS unavailable",
        ) from exc
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from exc
