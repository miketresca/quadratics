from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.core.config import Settings
from app.schemas.provider_keys import ProviderKeyMetadata, ProviderKeyName
from app.services.provider_keys.crypto import ProviderKeyCipher, ProviderKeyCryptoError, key_hint


class ProviderKeyStorageError(RuntimeError):
    pass


@dataclass(frozen=True)
class StoredProviderKey:
    provider: ProviderKeyName
    api_key: str


class SupabaseProviderKeyStore:
    def __init__(self, settings: Settings) -> None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise ProviderKeyStorageError("Supabase provider key storage is not configured")
        try:
            self._cipher = ProviderKeyCipher(settings.provider_keys_encryption_key)
        except ProviderKeyCryptoError as exc:
            raise ProviderKeyStorageError(str(exc)) from exc
        self._base_url = settings.supabase_url.rstrip("/")
        self._headers = {
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": "application/json",
        }

    async def list_metadata(self, user_id: str) -> list[ProviderKeyMetadata]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self._base_url}/rest/v1/user_provider_keys",
                headers=self._headers,
                params={
                    "user_id": f"eq.{user_id}",
                    "select": "provider,key_hint,updated_at",
                    "order": "provider.asc",
                },
            )
        _raise_for_storage_error(response)
        return [ProviderKeyMetadata.model_validate(row) for row in response.json()]

    async def upsert(
        self,
        user_id: str,
        provider: ProviderKeyName,
        api_key: str,
    ) -> ProviderKeyMetadata:
        stripped_key = api_key.strip()
        if not stripped_key:
            raise ProviderKeyStorageError("API key cannot be empty")
        encrypted_api_key = self._cipher.encrypt(stripped_key)
        hint = key_hint(stripped_key)
        payload = {
            "user_id": user_id,
            "provider": provider,
            "encrypted_api_key": encrypted_api_key,
            "key_hint": hint,
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self._base_url}/rest/v1/user_provider_keys",
                headers={
                    **self._headers,
                    "Prefer": "resolution=merge-duplicates,return=representation",
                },
                params={
                    "on_conflict": "user_id,provider",
                    "select": "provider,key_hint,updated_at",
                },
                json=payload,
            )
        _raise_for_storage_error(response)
        rows = response.json()
        if not rows:
            raise ProviderKeyStorageError("Provider key was not returned after save")
        return ProviderKeyMetadata.model_validate(rows[0])

    async def delete(self, user_id: str, provider: ProviderKeyName) -> None:
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{self._base_url}/rest/v1/user_provider_keys",
                headers=self._headers,
                params={
                    "user_id": f"eq.{user_id}",
                    "provider": f"eq.{provider}",
                },
            )
        _raise_for_storage_error(response)

    async def get_decrypted(
        self,
        user_id: str,
        provider: ProviderKeyName,
    ) -> StoredProviderKey | None:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self._base_url}/rest/v1/user_provider_keys",
                headers=self._headers,
                params={
                    "user_id": f"eq.{user_id}",
                    "provider": f"eq.{provider}",
                    "select": "provider,encrypted_api_key",
                    "limit": "1",
                },
            )
        _raise_for_storage_error(response)
        rows = response.json()
        if not rows:
            return None
        return StoredProviderKey(
            provider=rows[0]["provider"],
            api_key=self._cipher.decrypt(rows[0]["encrypted_api_key"]),
        )


def _raise_for_storage_error(response: httpx.Response) -> None:
    if response.is_success:
        return
    raise ProviderKeyStorageError(f"Provider key storage request failed: {response.status_code}")
