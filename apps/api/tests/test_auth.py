import pytest
from fastapi import HTTPException

from app.core.config import Settings
from app.core.security import verify_supabase_token


@pytest.mark.asyncio
async def test_protected_solve_rejects_unauthenticated(client):
    response = await client.post(
        "/api/v1/equations/solve",
        json={"equation": "2*x^2 - 7*x + 3 = 0"},
    )

    assert response.status_code in {401, 403}


@pytest.mark.asyncio
async def test_invalid_supabase_jwt_returns_unauthorized():
    settings = Settings(supabase_jwt_secret="test-secret")

    with pytest.raises(HTTPException) as exc_info:
        await verify_supabase_token("not-a-jwt", settings)

    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_dev_token_requires_explicit_bypass():
    settings = Settings(dev_auth_bypass=False)

    with pytest.raises(HTTPException) as exc_info:
        await verify_supabase_token("dev", settings)

    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_dev_auth_bypass_accepts_dev_token():
    settings = Settings(app_environment="development", dev_auth_bypass=True)

    user = await verify_supabase_token("dev", settings)

    assert user.id == "00000000-0000-0000-0000-000000000001"
    assert user.email == "dev@example.com"


@pytest.mark.asyncio
async def test_dev_auth_bypass_rejects_dev_token_in_production():
    settings = Settings(app_environment="production", dev_auth_bypass=True)

    with pytest.raises(HTTPException) as exc_info:
        await verify_supabase_token("dev", settings)

    assert exc_info.value.status_code == 401
