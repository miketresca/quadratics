import pytest
from httpx import ASGITransport, AsyncClient


@pytest.mark.asyncio
async def test_solve_endpoint_returns_factoring_lesson(authenticated_client):
    response = await authenticated_client.post(
        "/api/v1/equations/solve",
        json={"equation": "2*x^2 - 7*x + 3 = 0", "instructorId": "male"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert body["method"] == "factoring"
    assert body["coefficients"]["a"]["expression"] == "2"
    assert {solution["expression"] for solution in body["solutions"]} == {"1/2", "3"}
    assert [step["id"] for step in body["steps"]] == ["factor", "solve_factors", "final_answer"]
    assert "artifacts" not in body


@pytest.mark.asyncio
async def test_create_generation_persists_solution_and_lesson_artifacts(authenticated_client):
    response = await authenticated_client.post(
        "/api/v1/generations",
        json={"equation": "2*x^2 - 7*x + 3 = 0", "instructorId": "male"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["job"]["equationInput"] == "2*x^2 - 7*x + 3 = 0"
    assert body["lesson"]["method"] == "factoring"
    assert [artifact["stage"] for artifact in body["artifacts"]] == ["solution", "lesson"]
    assert all(artifact["status"] == "completed" for artifact in body["artifacts"])
    assert body["artifacts"][1]["upstreamArtifactIds"] == [body["artifacts"][0]["id"]]


@pytest.mark.asyncio
async def test_generation_snapshot_can_be_reloaded(authenticated_client):
    created = await authenticated_client.post(
        "/api/v1/generations",
        json={"equation": "x^2 + 5*x + 6 = 0"},
    )
    generation_id = created.json()["job"]["id"]

    response = await authenticated_client.get(f"/api/v1/generations/{generation_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["job"]["id"] == generation_id
    assert body["lesson"]["normalizedEquation"] == "x**2 + 5*x + 6 = 0"
    assert [artifact["stage"] for artifact in body["artifacts"]] == ["solution", "lesson"]


@pytest.mark.asyncio
async def test_solve_endpoint_accepts_bare_quadratic_expression(authenticated_client):
    response = await authenticated_client.post(
        "/api/v1/equations/solve",
        json={"equation": "2*x^2 - 7*x + 3", "instructorId": "male"},
    )

    assert response.status_code == 200
    assert response.json()["normalizedEquation"] == "2*x**2 - 7*x + 3 = 0"


@pytest.mark.asyncio
async def test_solve_endpoint_rejects_linear(authenticated_client):
    response = await authenticated_client.post(
        "/api/v1/equations/solve",
        json={"equation": "2*x + 3 = 0"},
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_solve_endpoint_returns_unsupported_method(authenticated_client):
    response = await authenticated_client.post(
        "/api/v1/equations/solve",
        json={"equation": "x^2 + x + 1 = 0"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "unsupported_instructional_method"


@pytest.mark.asyncio
async def test_solve_endpoint_rejects_oversized_input(authenticated_client):
    response = await authenticated_client.post(
        "/api/v1/equations/solve",
        json={"equation": f"{'x+' * 250}0 = 0"},
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_solve_endpoint_rejects_dev_token(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/equations/solve",
            headers={"Authorization": "Bearer dev"},
            json={"equation": "2*x^2 - 7*x + 3 = 0"},
        )

    assert response.status_code == 401
