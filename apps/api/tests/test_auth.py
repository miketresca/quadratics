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
async def test_dev_token_is_rejected():
    settings = Settings()

    with pytest.raises(HTTPException) as exc_info:
        await verify_supabase_token("dev", settings)

    assert exc_info.value.status_code == 401
