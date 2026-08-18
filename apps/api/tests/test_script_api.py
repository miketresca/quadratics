import pytest
from httpx import ASGITransport, AsyncClient

from app.api.routes import equations
from app.core.config import Settings, get_settings
from app.schemas.script import LessonScript, ScriptSegment
from app.services.scripts.base import ScriptGenerationRequest, ScriptProvider


class RecordingScriptProvider(ScriptProvider):
    def __init__(self) -> None:
        self.requests: list[ScriptGenerationRequest] = []

    async def generate_lesson_script(self, request: ScriptGenerationRequest) -> LessonScript:
        self.requests.append(request)
        return LessonScript(
            status="completed",
            method="factoring",
            segments=[
                ScriptSegment(
                    id="script_factor",
                    step_id="factor",
                    title="Factor the quadratic",
                    narration="First factor the quadratic into the two factors shown.",
                    math_line_ids=["standard_form", "factored_form"],
                    estimated_seconds=8,
                    word_count=9,
                ),
                ScriptSegment(
                    id="script_solve_factors",
                    step_id="solve_factors",
                    title="Solve each factor",
                    narration="Next use the zero product property and solve each factor.",
                    math_line_ids=[
                        "first_factor",
                        "first_isolate_x_term",
                        "first_solution",
                        "second_factor",
                        "second_solution",
                    ],
                    estimated_seconds=10,
                    word_count=10,
                ),
                ScriptSegment(
                    id="script_final_answer",
                    step_id="final_answer",
                    title="State the final answer",
                    narration="The solutions are one half and three.",
                    math_line_ids=["solutions"],
                    estimated_seconds=6,
                    word_count=7,
                ),
            ],
            provider_metadata={"provider": "recording-test"},
        )


@pytest.mark.asyncio
async def test_script_endpoint_returns_factoring_lesson_and_script(app, authenticated_client):
    app.dependency_overrides[get_settings] = lambda: Settings(script_generation_enabled=False)
    try:
        response = await authenticated_client.post(
            "/api/v1/equations/script",
            json={
                "equation": "2*x^2 - 7*x + 3",
                "instructorId": "male",
                "outputMode": "video_audio",
            },
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 200
    body = response.json()
    assert body["lesson"]["method"] == "factoring"
    assert body["script"]["status"] == "completed"
    assert [segment["stepId"] for segment in body["script"]["segments"]] == [
        "factor",
        "solve_factors",
        "final_answer",
    ]
    lesson_line_ids = {
        line["id"]
        for step in body["lesson"]["steps"]
        for line in step["mathLines"]
    }
    script_line_ids = {
        line_id
        for segment in body["script"]["segments"]
        for line_id in segment["mathLineIds"]
    }
    assert script_line_ids <= lesson_line_ids


@pytest.mark.asyncio
async def test_script_endpoint_can_use_injected_provider_when_generation_is_enabled(
    app,
    authenticated_client,
    monkeypatch,
):
    provider = RecordingScriptProvider()
    app.dependency_overrides[get_settings] = lambda: Settings(script_generation_enabled=True)
    monkeypatch.setattr(equations, "_script_provider", lambda _settings, _lesson: provider)

    try:
        response = await authenticated_client.post(
            "/api/v1/equations/script",
            json={
                "equation": "2*x^2 - 7*x + 3",
                "instructorId": "male",
                "outputMode": "audio",
            },
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 200
    body = response.json()
    assert body["script"]["providerMetadata"] == {"provider": "recording-test"}
    assert provider.requests
    assert provider.requests[0].lesson["steps"][0]["id"] == "factor"
    assert provider.requests[0].output_mode == "audio"


@pytest.mark.asyncio
async def test_script_endpoint_returns_unsupported_script_for_unsupported_lesson(
    app,
    authenticated_client,
):
    app.dependency_overrides[get_settings] = lambda: Settings(script_generation_enabled=True)
    try:
        response = await authenticated_client.post(
            "/api/v1/equations/script",
            json={"equation": "x^2 + x + 1", "outputMode": "audio"},
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 200
    body = response.json()
    assert body["lesson"]["status"] == "unsupported_instructional_method"
    assert body["script"]["status"] == "unsupported"
    assert body["script"]["segments"] == []


@pytest.mark.asyncio
async def test_script_endpoint_rejects_unauthenticated_requests(client):
    response = await client.post(
        "/api/v1/equations/script",
        json={"equation": "2*x^2 - 7*x + 3"},
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_script_endpoint_rejects_dev_token_without_local_environment(app):
    app.dependency_overrides[get_settings] = lambda: Settings(
        dev_auth_bypass=True,
        app_environment="production",
    )
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/equations/script",
                headers={"Authorization": "Bearer dev"},
                json={"equation": "2*x^2 - 7*x + 3"},
            )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_solve_endpoint_still_returns_only_lesson(authenticated_client):
    response = await authenticated_client.post(
        "/api/v1/equations/solve",
        json={"equation": "2*x^2 - 7*x + 3"},
    )

    assert response.status_code == 200
    body = response.json()
    assert "script" not in body
    assert body["method"] == "factoring"
