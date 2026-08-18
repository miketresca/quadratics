from collections.abc import AsyncIterator, Iterator

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.dependencies.auth import get_current_user
from app.core.security import AuthenticatedUser
from app.main import create_app


@pytest.fixture
def app() -> FastAPI:
    return create_app()


@pytest_asyncio.fixture
async def client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as test_client:
        yield test_client


@pytest.fixture
def authenticated_app(app: FastAPI) -> Iterator[FastAPI]:
    async def fake_current_user() -> AuthenticatedUser:
        return AuthenticatedUser(
            id="00000000-0000-0000-0000-000000000001",
            email="student@example.com",
        )

    app.dependency_overrides[get_current_user] = fake_current_user
    yield app
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def authenticated_client(authenticated_app: FastAPI) -> AsyncIterator[AsyncClient]:
    async with AsyncClient(
        transport=ASGITransport(app=authenticated_app),
        base_url="http://test",
    ) as test_client:
        yield test_client
