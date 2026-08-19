from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import UTC, datetime
from threading import Lock
from uuid import uuid4

from app.schemas.artifact import ArtifactStage, ArtifactStatus


@dataclass(frozen=True)
class ArtifactStorageReference:
    bucket: str
    path: str
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
