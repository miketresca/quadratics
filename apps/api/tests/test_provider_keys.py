import pytest
from cryptography.fernet import Fernet

from app.services.provider_keys.crypto import ProviderKeyCipher, key_hint


def test_provider_key_cipher_round_trips_secret():
    cipher = ProviderKeyCipher(Fernet.generate_key().decode())

    encrypted = cipher.encrypt("heygen-secret")

    assert encrypted != "heygen-secret"
    assert cipher.decrypt(encrypted) == "heygen-secret"


def test_provider_key_hint_masks_key():
    assert key_hint("heygen_123456789") == "hey...6789"


@pytest.mark.asyncio
async def test_provider_keys_reject_unauthenticated(client):
    response = await client.get("/api/v1/provider-keys")

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_provider_keys_require_storage_configuration(authenticated_client):
    response = await authenticated_client.get("/api/v1/provider-keys")

    assert response.status_code == 503
