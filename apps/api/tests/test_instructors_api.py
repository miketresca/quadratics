import pytest


@pytest.mark.asyncio
async def test_public_instructors_hide_provider_ids(client):
    response = await client.get("/api/v1/instructors/public")

    assert response.status_code == 200
    body = response.json()
    assert [instructor["displayName"] for instructor in body] == [
        "Male Instructor",
        "Female Instructor",
    ]
    assert body[0]["referenceImageUrl"] == "https://example.com/male.png"
    assert body[1]["referenceImageUrl"] == "https://example.com/female.png"
    assert "voiceId" not in body[0]
    assert "avatarId" not in body[0]


@pytest.mark.asyncio
async def test_instructors_can_be_created_updated_and_deleted(authenticated_client):
    created = await authenticated_client.post(
        "/api/v1/instructors",
        json={
            "displayName": "Demo Instructor",
            "voiceId": "voice-demo",
            "avatarId": "avatar-demo",
            "referenceImageUrl": "data:image/png;base64,abc",
            "imageZoom": 1.2,
            "imageX": 44,
            "imageY": 56,
        },
    )

    assert created.status_code == 201
    body = created.json()
    assert body["displayName"] == "Demo Instructor"
    assert body["voiceId"] == "voice-demo"
    assert body["avatarId"] == "avatar-demo"
    assert body["referenceImageUrl"] == "data:image/png;base64,abc"

    updated = await authenticated_client.put(
        f"/api/v1/instructors/{body['id']}",
        json={
            "displayName": "Updated Instructor",
            "voiceId": "voice-updated",
            "avatarId": "avatar-updated",
            "referenceImageUrl": None,
            "imageZoom": 1,
            "imageX": 50,
            "imageY": 50,
        },
    )

    assert updated.status_code == 200
    assert updated.json()["displayName"] == "Updated Instructor"
    assert updated.json()["voiceId"] == "voice-updated"
    assert updated.json()["avatarId"] == "avatar-updated"

    listed = await authenticated_client.get("/api/v1/instructors")
    assert listed.status_code == 200
    assert listed.json()[0]["displayName"] == "Male Instructor"
    assert any(instructor["id"] == body["id"] for instructor in listed.json())

    deleted = await authenticated_client.delete(f"/api/v1/instructors/{body['id']}")
    assert deleted.status_code == 204
