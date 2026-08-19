from collections.abc import AsyncIterator, Iterator

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.dependencies.auth import get_current_user
from app.api.routes import instructors
from app.core.config import Settings, get_settings
from app.core.security import AuthenticatedUser
from app.main import create_app
from app.schemas.instructor import Instructor
from app.services.instructors.repository import InMemoryInstructorRepository


@pytest.fixture(autouse=True)
def test_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENVIRONMENT", "test")


@pytest.fixture
def app() -> FastAPI:
    get_settings.cache_clear()
    instructors._instructors = InMemoryInstructorRepository(
        [
            Instructor(id="male", display_name="Male Instructor", voice_id="male-voice"),
            Instructor(id="female", display_name="Female Instructor", voice_id="female-voice"),
        ]
    )
    test_app = create_app()
    test_app.dependency_overrides[get_settings] = lambda: Settings(
        supabase_url="",
        supabase_service_role_key="",
        supabase_anon_key="",
        supabase_jwt_secret="test-secret",
        supabase_jwks_url="",
    )
    return test_app


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
