from __future__ import annotations

import hashlib
from abc import ABC, abstractmethod
from dataclasses import dataclass
from threading import Lock

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
