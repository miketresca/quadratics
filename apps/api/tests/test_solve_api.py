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
