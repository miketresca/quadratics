import pytest


@pytest.mark.asyncio
async def test_me_provisions_profile_and_default_credits(authenticated_client):
    response = await authenticated_client.get("/api/v1/me")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == "00000000-0000-0000-0000-000000000001"
    assert body["email"] == "student@example.com"
    assert body["creditBalance"] >= 20
