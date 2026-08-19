from __future__ import annotations

import hashlib
from abc import ABC, abstractmethod
from dataclasses import dataclass
from threading import Lock

import httpx

from app.core.config import Settings
from app.services.artifacts.repository import ArtifactStorageReference


@dataclass(frozen=True)
class StoredMediaObject:
    reference: ArtifactStorageReference
    content: bytes


class MediaStore(ABC):
    @abstractmethod
    def put(
        self,
        *,
        path: str,
        content: bytes,
        content_type: str,
        metadata: dict[str, object] | None = None,
    ) -> ArtifactStorageReference:
        """Store private media bytes and return durable object metadata."""

    def signed_url(self, *, bucket: str, path: str, expires_in_seconds: int = 3600) -> str | None:
        return None


class InMemoryMediaStore(MediaStore):
    def __init__(self, *, bucket: str) -> None:
        self._bucket = bucket
        self._objects: dict[str, StoredMediaObject] = {}
        self._lock = Lock()

    def put(
        self,
        *,
        path: str,
        content: bytes,
        content_type: str,
        metadata: dict[str, object] | None = None,
    ) -> ArtifactStorageReference:
        reference = ArtifactStorageReference(
            bucket=self._bucket,
            path=path,
            content_type=content_type,
            size_bytes=len(content),
            checksum_sha256=hashlib.sha256(content).hexdigest(),
            metadata=metadata or {},
        )
        with self._lock:
            self._objects[path] = StoredMediaObject(reference=reference, content=content)
        return reference

    def get(self, path: str) -> bytes | None:
        with self._lock:
            stored = self._objects.get(path)
            return stored.content if stored else None


class SupabaseMediaStore(MediaStore):
    def __init__(self, settings: Settings, *, bucket: str) -> None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise MediaStoreError("Supabase media storage is not configured")
        self._bucket = bucket
        self._base_url = settings.supabase_url.rstrip("/")
        self._headers = {
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
        }

    def put(
        self,
        *,
        path: str,
        content: bytes,
        content_type: str,
        metadata: dict[str, object] | None = None,
    ) -> ArtifactStorageReference:
        normalized_path = path.lstrip("/")
        checksum = hashlib.sha256(content).hexdigest()
        with httpx.Client() as client:
            response = client.put(
                f"{self._base_url}/storage/v1/object/{self._bucket}/{normalized_path}",
                headers={
                    **self._headers,
                    "Content-Type": content_type,
                    "x-upsert": "true",
                },
                content=content,
            )
        _raise_for_media_error(response)
        return ArtifactStorageReference(
            bucket=self._bucket,
            path=normalized_path,
            signed_url=self.signed_url(bucket=self._bucket, path=normalized_path),
            content_type=content_type,
            size_bytes=len(content),
            checksum_sha256=checksum,
            metadata=metadata or {},
        )

    def signed_url(self, *, bucket: str, path: str, expires_in_seconds: int = 3600) -> str | None:
        if bucket != self._bucket:
            return None
        normalized_path = path.lstrip("/")
        with httpx.Client() as client:
            response = client.post(
                f"{self._base_url}/storage/v1/object/sign/{self._bucket}/{normalized_path}",
                headers={
                    **self._headers,
                    "Content-Type": "application/json",
                },
                json={"expiresIn": expires_in_seconds},
            )
        _raise_for_media_error(response)
        body = response.json()
        signed_url = body.get("signedURL") or body.get("signedUrl")
        if not isinstance(signed_url, str):
            raise MediaStoreError("Supabase did not return a signed media URL")
        if signed_url.startswith("http"):
            return signed_url
        return f"{self._base_url}/storage/v1{signed_url}"


class MediaStoreError(RuntimeError):
    pass


def _raise_for_media_error(response: httpx.Response) -> None:
    if response.is_success:
        return
    detail = response.text.strip()
    if detail:
        raise MediaStoreError(
            f"Media storage request failed: {response.status_code}: {detail}"
        )
    raise MediaStoreError(f"Media storage request failed: {response.status_code}")
