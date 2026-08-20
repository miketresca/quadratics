from collections.abc import AsyncIterator, Iterator

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.dependencies.auth import get_current_user
from app.api.routes import generations, instructors, usage_costs
from app.core.config import Settings, get_settings
from app.core.security import AuthenticatedUser
from app.main import create_app
from app.schemas.instructor import Instructor
from app.services.artifacts import InMemoryArtifactRepository
from app.services.instructors.repository import InMemoryInstructorRepository
from app.services.jobs.generation_jobs import InMemoryGenerationJobRepository
from app.services.pipeline.solve_snapshot import SolveGenerationService
from app.services.storage.media_store import InMemoryMediaStore
from app.services.usage.costs import InMemoryUsageCostRepository


@pytest.fixture(autouse=True)
def test_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENVIRONMENT", "test")


@pytest.fixture
def app() -> FastAPI:
    get_settings.cache_clear()
    generations._jobs = InMemoryGenerationJobRepository()
    generations._artifacts = InMemoryArtifactRepository()
    generations._media_store = InMemoryMediaStore(bucket="generated-media")
    generations._solve_generations = SolveGenerationService(
        jobs=generations._jobs,
        artifacts=generations._artifacts,
    )
    instructors._instructors = InMemoryInstructorRepository(
        [
            Instructor(
                id="male",
                display_name="Male Instructor",
                voice_id="male-voice",
                reference_image_url="https://example.com/male.png",
                avatar_id="male-avatar",
            ),
            Instructor(
                id="female",
                display_name="Female Instructor",
                voice_id="female-voice",
                reference_image_url="https://example.com/female.png",
                avatar_id="female-avatar",
            ),
        ]
    )
    usage_costs._usage_costs = InMemoryUsageCostRepository()
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
