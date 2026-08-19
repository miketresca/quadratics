from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime
from threading import Lock
from uuid import uuid4

import httpx

from app.core.config import Settings
from app.schemas.artifact import ArtifactStage, ArtifactStatus


@dataclass(frozen=True)
class ArtifactStorageReference:
    bucket: str
    path: str
    signed_url: str | None = None
    content_type: str | None = None
    size_bytes: int | None = None
    checksum_sha256: str | None = None
    duration_seconds: float | None = None
    metadata: dict[str, object] = field(default_factory=dict)


@dataclass(frozen=True)
class ArtifactRecord:
    id: str
    generation_job_id: str
    user_id: str
    stage: ArtifactStage
    version: int
    status: ArtifactStatus
    input_hash: str
    upstream_artifact_ids: list[str] = field(default_factory=list)
    provider: str | None = None
    model: str | None = None
    config_metadata: dict[str, object] = field(default_factory=dict)
    payload: dict[str, object] = field(default_factory=dict)
    storage_objects: list[ArtifactStorageReference] = field(default_factory=list)
    is_current: bool = False
    cache_hit: bool = False
    stale_reason: str | None = None
    error_code: str | None = None
    error_message: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    completed_at: datetime | None = None


@dataclass(frozen=True)
class ArtifactDependencyRecord:
    generation_job_id: str
    upstream_artifact_id: str
    downstream_artifact_id: str
    dependency_hash: str | None = None
    metadata: dict[str, object] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))


class InMemoryArtifactRepository:
    def __init__(self) -> None:
        self._artifacts: dict[str, ArtifactRecord] = {}
        self._dependencies: list[ArtifactDependencyRecord] = []
        self._lock = Lock()

    def create_attempt(
        self,
        *,
        generation_job_id: str,
        user_id: str,
        stage: ArtifactStage,
        input_hash: str,
        upstream_artifact_ids: list[str] | None = None,
        provider: str | None = None,
        model: str | None = None,
        config_metadata: dict[str, object] | None = None,
    ) -> ArtifactRecord:
        upstreams = upstream_artifact_ids or []
        with self._lock:
            version = self._next_version(generation_job_id=generation_job_id, stage=stage)
            artifact = ArtifactRecord(
                id=str(uuid4()),
                generation_job_id=generation_job_id,
                user_id=user_id,
                stage=stage,
                version=version,
                status="running",
                input_hash=input_hash,
                upstream_artifact_ids=list(upstreams),
                provider=provider,
                model=model,
                config_metadata=config_metadata or {},
            )
            self._artifacts[artifact.id] = artifact
            for upstream_id in upstreams:
                self._dependencies.append(
                    ArtifactDependencyRecord(
                        generation_job_id=generation_job_id,
                        upstream_artifact_id=upstream_id,
                        downstream_artifact_id=artifact.id,
                    )
                )
            return artifact

    def complete_attempt(
        self,
        artifact_id: str,
        *,
        payload: dict[str, object] | None = None,
        storage_objects: list[ArtifactStorageReference] | None = None,
    ) -> ArtifactRecord:
        with self._lock:
            artifact = self._require_artifact(artifact_id)
            previous_currents = [
                current
                for current in self._artifacts.values()
                if current.generation_job_id == artifact.generation_job_id
                and current.stage == artifact.stage
                and current.id != artifact.id
                and current.is_current
            ]
            for current in previous_currents:
                self._artifacts[current.id] = replace(current, is_current=False)
            completed = replace(
                artifact,
                status="completed",
                payload=payload or artifact.payload,
                storage_objects=storage_objects or artifact.storage_objects,
                is_current=True,
                stale_reason=None,
                error_code=None,
                error_message=None,
                completed_at=datetime.now(UTC),
            )
            self._artifacts[artifact.id] = completed
            for previous in previous_currents:
                self._mark_descendants_stale_locked(
                    previous.id,
                    reason=f"{artifact.stage} was regenerated after this artifact was created.",
                )
            return completed

    def fail_attempt(
        self,
        artifact_id: str,
        *,
        error_code: str,
        error_message: str,
    ) -> ArtifactRecord:
        with self._lock:
            artifact = self._require_artifact(artifact_id)
            failed = replace(
                artifact,
                status="failed",
                is_current=False,
                error_code=error_code,
                error_message=error_message,
            )
            self._artifacts[artifact.id] = failed
            return failed

    def find_reusable(
        self,
        *,
        generation_job_id: str,
        stage: ArtifactStage,
        input_hash: str,
    ) -> ArtifactRecord | None:
        with self._lock:
            matches = [
                artifact
                for artifact in self._artifacts.values()
                if artifact.generation_job_id == generation_job_id
                and artifact.stage == stage
                and artifact.input_hash == input_hash
                and artifact.status == "completed"
            ]
            if not matches:
                return None
            return max(matches, key=lambda artifact: artifact.version)

    def get(self, artifact_id: str) -> ArtifactRecord:
        with self._lock:
            return self._require_artifact(artifact_id)

    def dependencies_for_upstream(self, artifact_id: str) -> list[ArtifactDependencyRecord]:
        with self._lock:
            return [
                dependency
                for dependency in self._dependencies
                if dependency.upstream_artifact_id == artifact_id
            ]

    def list_for_generation(self, generation_job_id: str) -> list[ArtifactRecord]:
        with self._lock:
            return sorted(
                [
                    artifact
                    for artifact in self._artifacts.values()
                    if artifact.generation_job_id == generation_job_id
                ],
                key=lambda artifact: (artifact.created_at, artifact.version),
            )

    def current_for_stage(
        self,
        *,
        generation_job_id: str,
        stage: ArtifactStage,
    ) -> ArtifactRecord | None:
        with self._lock:
            currents = [
                artifact
                for artifact in self._artifacts.values()
                if artifact.generation_job_id == generation_job_id
                and artifact.stage == stage
                and artifact.is_current
            ]
            if not currents:
                return None
            return max(currents, key=lambda artifact: artifact.version)

    def dependencies_for_generation(self, generation_job_id: str) -> list[ArtifactDependencyRecord]:
        with self._lock:
            return [
                dependency
                for dependency in self._dependencies
                if dependency.generation_job_id == generation_job_id
            ]

    def mark_descendants_stale(self, artifact_id: str, *, reason: str) -> list[ArtifactRecord]:
        with self._lock:
            return self._mark_descendants_stale_locked(artifact_id, reason=reason)

    def _next_version(self, *, generation_job_id: str, stage: ArtifactStage) -> int:
        versions = [
            artifact.version
            for artifact in self._artifacts.values()
            if artifact.generation_job_id == generation_job_id and artifact.stage == stage
        ]
        return max(versions, default=0) + 1

    def _require_artifact(self, artifact_id: str) -> ArtifactRecord:
        artifact = self._artifacts.get(artifact_id)
        if artifact is None:
            raise KeyError(f"unknown artifact {artifact_id}")
        return artifact

    def _mark_descendants_stale_locked(
        self,
        artifact_id: str,
        *,
        reason: str,
    ) -> list[ArtifactRecord]:
        stale_records: list[ArtifactRecord] = []
        queue = [artifact_id]
        seen = {artifact_id}
        while queue:
            current_id = queue.pop(0)
            downstream_ids = [
                dependency.downstream_artifact_id
                for dependency in self._dependencies
                if dependency.upstream_artifact_id == current_id
            ]
            for downstream_id in downstream_ids:
                if downstream_id in seen:
                    continue
                seen.add(downstream_id)
                queue.append(downstream_id)
                downstream = self._artifacts[downstream_id]
                if downstream.status in ("completed", "running"):
                    stale = replace(
                        downstream,
                        status="stale",
                        is_current=False,
                        stale_reason=reason,
                    )
                    self._artifacts[downstream_id] = stale
                    stale_records.append(stale)
        return stale_records


SignedUrlResolver = Callable[[str, str], str | None]


class SupabaseArtifactRepository:
    def __init__(
        self,
        settings: Settings,
        *,
        signed_url_resolver: SignedUrlResolver | None = None,
    ) -> None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise ArtifactStorageError("Supabase artifact storage is not configured")
        self._base_url = settings.supabase_url.rstrip("/")
        self._headers = {
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": "application/json",
        }
        self._signed_url_resolver = signed_url_resolver

    def create_attempt(
        self,
        *,
        generation_job_id: str,
        user_id: str,
        stage: ArtifactStage,
        input_hash: str,
        upstream_artifact_ids: list[str] | None = None,
        provider: str | None = None,
        model: str | None = None,
        config_metadata: dict[str, object] | None = None,
    ) -> ArtifactRecord:
        upstreams = upstream_artifact_ids or []
        version = self._next_version(generation_job_id=generation_job_id, stage=stage)
        with httpx.Client() as client:
            response = client.post(
                f"{self._base_url}/rest/v1/generation_artifacts",
                headers={**self._headers, "Prefer": "return=representation"},
                params={"select": _ARTIFACT_COLUMNS},
                json={
                    "generation_job_id": generation_job_id,
                    "user_id": user_id,
                    "stage": stage,
                    "version": version,
                    "status": "running",
                    "input_hash": input_hash,
                    "upstream_artifact_ids": upstreams,
                    "provider": provider,
                    "model": model,
                    "config_metadata": config_metadata or {},
                },
            )
        _raise_for_artifact_storage_error(response)
        rows = response.json()
        if not rows:
            raise ArtifactStorageError("Artifact was not returned after create")
        artifact = self._artifact_from_row(rows[0])
        self._insert_dependencies(
            generation_job_id=generation_job_id,
            upstream_artifact_ids=upstreams,
            downstream_artifact_id=artifact.id,
        )
        return artifact

    def complete_attempt(
        self,
        artifact_id: str,
        *,
        payload: dict[str, object] | None = None,
        storage_objects: list[ArtifactStorageReference] | None = None,
    ) -> ArtifactRecord:
        artifact = self.get(artifact_id)
        previous_currents = [
            current
            for current in self.list_for_generation(artifact.generation_job_id)
            if current.stage == artifact.stage and current.id != artifact.id and current.is_current
        ]
        for current in previous_currents:
            self._patch_artifact(current.id, {"is_current": False}, return_representation=False)
        completed = self._patch_artifact(
            artifact.id,
            {
                "status": "completed",
                "payload_json": payload or artifact.payload,
                "storage_objects": [
                    _storage_reference_to_row(storage_reference)
                    for storage_reference in (storage_objects or artifact.storage_objects)
                ],
                "is_current": True,
                "stale_reason": None,
                "error_code": None,
                "error_message": None,
                "completed_at": datetime.now(UTC).isoformat(),
            },
            return_representation=True,
        )
        for previous in previous_currents:
            self.mark_descendants_stale(
                previous.id,
                reason=f"{artifact.stage} was regenerated after this artifact was created.",
            )
        return completed

    def fail_attempt(
        self,
        artifact_id: str,
        *,
        error_code: str,
        error_message: str,
    ) -> ArtifactRecord:
        return self._patch_artifact(
            artifact_id,
            {
                "status": "failed",
                "is_current": False,
                "error_code": error_code,
                "error_message": error_message,
            },
            return_representation=True,
        )

    def find_reusable(
        self,
        *,
        generation_job_id: str,
        stage: ArtifactStage,
        input_hash: str,
    ) -> ArtifactRecord | None:
        rows = self._get_rows(
            "generation_artifacts",
            {
                "generation_job_id": f"eq.{generation_job_id}",
                "stage": f"eq.{stage}",
                "input_hash": f"eq.{input_hash}",
                "status": "eq.completed",
                "select": _ARTIFACT_COLUMNS,
                "order": "version.desc",
                "limit": "1",
            },
        )
        return self._artifact_from_row(rows[0]) if rows else None

    def get(self, artifact_id: str) -> ArtifactRecord:
        rows = self._get_rows(
            "generation_artifacts",
            {"id": f"eq.{artifact_id}", "select": _ARTIFACT_COLUMNS, "limit": "1"},
        )
        if not rows:
            raise KeyError(f"unknown artifact {artifact_id}")
        return self._artifact_from_row(rows[0])

    def dependencies_for_upstream(self, artifact_id: str) -> list[ArtifactDependencyRecord]:
        rows = self._get_rows(
            "generation_artifact_dependencies",
            {"upstream_artifact_id": f"eq.{artifact_id}", "select": _DEPENDENCY_COLUMNS},
        )
        return [_dependency_from_row(row) for row in rows]

    def list_for_generation(self, generation_job_id: str) -> list[ArtifactRecord]:
        rows = self._get_rows(
            "generation_artifacts",
            {
                "generation_job_id": f"eq.{generation_job_id}",
                "select": _ARTIFACT_COLUMNS,
                "order": "created_at.asc,version.asc",
            },
        )
        return [self._artifact_from_row(row) for row in rows]

    def current_for_stage(
        self,
        *,
        generation_job_id: str,
        stage: ArtifactStage,
    ) -> ArtifactRecord | None:
        rows = self._get_rows(
            "generation_artifacts",
            {
                "generation_job_id": f"eq.{generation_job_id}",
                "stage": f"eq.{stage}",
                "is_current": "eq.true",
                "select": _ARTIFACT_COLUMNS,
                "order": "version.desc",
                "limit": "1",
            },
        )
        return self._artifact_from_row(rows[0]) if rows else None

    def dependencies_for_generation(self, generation_job_id: str) -> list[ArtifactDependencyRecord]:
        rows = self._get_rows(
            "generation_artifact_dependencies",
            {
                "generation_job_id": f"eq.{generation_job_id}",
                "select": _DEPENDENCY_COLUMNS,
                "order": "created_at.asc",
            },
        )
        return [_dependency_from_row(row) for row in rows]

    def mark_descendants_stale(self, artifact_id: str, *, reason: str) -> list[ArtifactRecord]:
        stale_records: list[ArtifactRecord] = []
        queue = [artifact_id]
        seen = {artifact_id}
        while queue:
            current_id = queue.pop(0)
            for dependency in self.dependencies_for_upstream(current_id):
                downstream_id = dependency.downstream_artifact_id
                if downstream_id in seen:
                    continue
                seen.add(downstream_id)
                queue.append(downstream_id)
                downstream = self.get(downstream_id)
                if downstream.status in ("completed", "running"):
                    stale_records.append(
                        self._patch_artifact(
                            downstream.id,
                            {
                                "status": "stale",
                                "is_current": False,
                                "stale_reason": reason,
                            },
                            return_representation=True,
                        )
                    )
        return stale_records

    def _next_version(self, *, generation_job_id: str, stage: ArtifactStage) -> int:
        rows = self._get_rows(
            "generation_artifacts",
            {
                "generation_job_id": f"eq.{generation_job_id}",
                "stage": f"eq.{stage}",
                "select": "version",
                "order": "version.desc",
                "limit": "1",
            },
        )
        return int(rows[0]["version"]) + 1 if rows else 1

    def _get_rows(self, table: str, params: dict[str, str]) -> list[dict[str, object]]:
        with httpx.Client() as client:
            response = client.get(
                f"{self._base_url}/rest/v1/{table}",
                headers=self._headers,
                params=params,
            )
        _raise_for_artifact_storage_error(response)
        return response.json()

    def _insert_dependencies(
        self,
        *,
        generation_job_id: str,
        upstream_artifact_ids: list[str],
        downstream_artifact_id: str,
    ) -> None:
        if not upstream_artifact_ids:
            return
        rows = [
            {
                "generation_job_id": generation_job_id,
                "upstream_artifact_id": upstream_id,
                "downstream_artifact_id": downstream_artifact_id,
            }
            for upstream_id in upstream_artifact_ids
        ]
        with httpx.Client() as client:
            response = client.post(
                f"{self._base_url}/rest/v1/generation_artifact_dependencies",
                headers=self._headers,
                json=rows,
            )
        _raise_for_artifact_storage_error(response)

    def _patch_artifact(
        self,
        artifact_id: str,
        payload: dict[str, object],
        *,
        return_representation: bool,
    ) -> ArtifactRecord:
        headers = self._headers
        if return_representation:
            headers = {**headers, "Prefer": "return=representation"}
        with httpx.Client() as client:
            response = client.patch(
                f"{self._base_url}/rest/v1/generation_artifacts",
                headers=headers,
                params={"id": f"eq.{artifact_id}", "select": _ARTIFACT_COLUMNS},
                json=payload,
            )
        _raise_for_artifact_storage_error(response)
        if not return_representation:
            return self.get(artifact_id)
        rows = response.json()
        if not rows:
            raise ArtifactStorageError("Artifact was not returned after update")
        return self._artifact_from_row(rows[0])

    def _artifact_from_row(self, row: dict[str, object]) -> ArtifactRecord:
        return _artifact_from_row(row, signed_url_resolver=self._signed_url_resolver)


class ArtifactStorageError(RuntimeError):
    pass


_ARTIFACT_COLUMNS = (
    "id,generation_job_id,user_id,stage,version,status,input_hash,upstream_artifact_ids,"
    "provider,model,config_metadata,payload_json,storage_objects,is_current,cache_hit,"
    "stale_reason,error_code,error_message,created_at,completed_at"
)
_DEPENDENCY_COLUMNS = (
    "generation_job_id,upstream_artifact_id,downstream_artifact_id,dependency_hash,"
    "metadata,created_at"
)


def _artifact_from_row(
    row: dict[str, object],
    *,
    signed_url_resolver: SignedUrlResolver | None = None,
) -> ArtifactRecord:
    return ArtifactRecord(
        id=str(row["id"]),
        generation_job_id=str(row["generation_job_id"]),
        user_id=str(row["user_id"]),
        stage=row["stage"],  # type: ignore[arg-type]
        version=int(row["version"]),
        status=row["status"],  # type: ignore[arg-type]
        input_hash=str(row["input_hash"]),
        upstream_artifact_ids=[str(value) for value in row.get("upstream_artifact_ids") or []],
        provider=_optional_str(row.get("provider")),
        model=_optional_str(row.get("model")),
        config_metadata=dict(row.get("config_metadata") or {}),
        payload=dict(row.get("payload_json") or {}),
        storage_objects=[
            _storage_reference_from_row(storage_object, signed_url_resolver=signed_url_resolver)
            for storage_object in _list_of_dicts(row.get("storage_objects"))
        ],
        is_current=bool(row.get("is_current")),
        cache_hit=bool(row.get("cache_hit")),
        stale_reason=_optional_str(row.get("stale_reason")),
        error_code=_optional_str(row.get("error_code")),
        error_message=_optional_str(row.get("error_message")),
        created_at=_parse_datetime(str(row["created_at"])),
        completed_at=_parse_datetime(str(row["completed_at"])) if row.get("completed_at") else None,
    )


def _dependency_from_row(row: dict[str, object]) -> ArtifactDependencyRecord:
    return ArtifactDependencyRecord(
        generation_job_id=str(row["generation_job_id"]),
        upstream_artifact_id=str(row["upstream_artifact_id"]),
        downstream_artifact_id=str(row["downstream_artifact_id"]),
        dependency_hash=_optional_str(row.get("dependency_hash")),
        metadata=dict(row.get("metadata") or {}),
        created_at=_parse_datetime(str(row["created_at"])),
    )


def _storage_reference_from_row(
    row: dict[str, object],
    *,
    signed_url_resolver: SignedUrlResolver | None,
) -> ArtifactStorageReference:
    bucket = str(row["bucket"])
    path = str(row["path"])
    signed_url = _optional_str(row.get("signedUrl")) or _optional_str(row.get("signed_url"))
    if signed_url is None and signed_url_resolver is not None:
        signed_url = signed_url_resolver(bucket, path)
    return ArtifactStorageReference(
        bucket=bucket,
        path=path,
        signed_url=signed_url,
        content_type=_optional_str(row.get("contentType") or row.get("content_type")),
        size_bytes=_optional_int(row.get("sizeBytes") or row.get("size_bytes")),
        checksum_sha256=_optional_str(row.get("checksumSha256") or row.get("checksum_sha256")),
        duration_seconds=_optional_float(row.get("durationSeconds") or row.get("duration_seconds")),
        metadata=dict(row.get("metadata") or {}),
    )


def _storage_reference_to_row(reference: ArtifactStorageReference) -> dict[str, object | None]:
    return {
        "bucket": reference.bucket,
        "path": reference.path,
        "contentType": reference.content_type,
        "sizeBytes": reference.size_bytes,
        "checksumSha256": reference.checksum_sha256,
        "durationSeconds": reference.duration_seconds,
        "metadata": reference.metadata,
    }


def _list_of_dicts(value: object) -> list[dict[str, object]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _optional_str(value: object) -> str | None:
    return str(value) if value is not None else None


def _optional_int(value: object) -> int | None:
    return int(value) if value is not None else None


def _optional_float(value: object) -> float | None:
    return float(value) if value is not None else None


def _parse_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _raise_for_artifact_storage_error(response: httpx.Response) -> None:
    if response.is_success:
        return
    raise ArtifactStorageError(f"Artifact storage request failed: {response.status_code}")
