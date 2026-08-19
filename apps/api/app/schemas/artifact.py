from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import Field, model_validator

from app.schemas.common import ApiModel

ArtifactStatus = Literal["pending", "running", "completed", "failed", "stale", "skipped"]

ArtifactStage = Literal[
    "solution",
    "lesson",
    "real_world_context",
    "teacher_script",
    "elevenlabs_request",
    "elevenlabs_audio",
    "animation_plan",
    "resolved_timeline",
    "motion_canvas_render",
    "base_video",
    "heygen_avatar",
    "avatar_composition",
    "final_video",
]


class ArtifactStorageObject(ApiModel):
    bucket: str = Field(min_length=1)
    path: str = Field(min_length=1)
    signed_url: str | None = None
    content_type: str | None = None
    size_bytes: int | None = Field(default=None, ge=0)
    checksum_sha256: str | None = Field(default=None, min_length=1)
    duration_seconds: float | None = Field(default=None, ge=0)
    metadata: dict[str, Any] = Field(default_factory=dict)


class GenerationArtifact(ApiModel):
    id: UUID
    generation_job_id: UUID
    user_id: UUID
    stage: ArtifactStage
    version: int = Field(ge=1)
    status: ArtifactStatus
    input_hash: str = Field(min_length=1)
    upstream_artifact_ids: list[UUID] = Field(default_factory=list)
    provider: str | None = None
    model: str | None = None
    config_metadata: dict[str, Any] = Field(default_factory=dict)
    payload: dict[str, Any] = Field(default_factory=dict)
    storage_objects: list[ArtifactStorageObject] = Field(default_factory=list)
    is_current: bool = False
    cache_hit: bool = False
    stale_reason: str | None = None
    error_code: str | None = None
    error_message: str | None = None
    created_at: datetime
    completed_at: datetime | None = None

    @model_validator(mode="after")
    def lifecycle_metadata_matches_status(self) -> "GenerationArtifact":
        if self.status == "stale" and not self.stale_reason:
            raise ValueError("stale artifact must include stale_reason")
        if self.status != "stale" and self.stale_reason:
            raise ValueError("only stale artifacts may include stale_reason")
        if self.status == "failed" and not (self.error_code or self.error_message):
            raise ValueError("failed artifact must include error metadata")
        if self.status != "failed" and (self.error_code or self.error_message):
            raise ValueError("only failed artifacts may include error metadata")
        if self.status == "completed" and self.completed_at is None:
            raise ValueError("completed artifact must include completed_at")
        return self


class GenerationArtifactDependency(ApiModel):
    generation_job_id: UUID
    upstream_artifact_id: UUID
    downstream_artifact_id: UUID
    dependency_hash: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

    @model_validator(mode="after")
    def dependency_must_not_self_reference(self) -> "GenerationArtifactDependency":
        if self.upstream_artifact_id == self.downstream_artifact_id:
            raise ValueError("artifact dependency cannot reference itself")
        return self
