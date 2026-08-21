from __future__ import annotations

from typing import Any, Literal

from app.schemas.common import ApiModel

GameWorksheetTemplateId = Literal["volume-cubes-lesson-1"]
GameLessonStage = Literal[
    "template",
    "section_script",
    "speech_markup",
    "narration",
    "handwriting",
    "interactive_bundle",
    "lesson_publish",
]
GameLessonArtifactStatus = Literal[
    "pending",
    "running",
    "completed",
    "failed",
    "awaiting_approval",
    "approved",
    "rejected",
    "stale",
]
GameLessonApprovalDecision = Literal["approved", "rejected"]
GameWorksheetRunStatus = Literal["active", "completed", "failed"]


class GameWorksheetTemplate(ApiModel):
    id: str
    title: str
    version: int
    payload: dict[str, Any]


class GameLessonArtifact(ApiModel):
    id: str
    run_id: str
    stage: str
    version: int
    status: GameLessonArtifactStatus
    is_current: bool
    payload: dict[str, Any]
    storage_refs: list[dict[str, Any]]
    error_message: str | None = None
    stale_reason: str | None = None
    config_metadata: dict[str, Any]
    created_at: str
    updated_at: str


class GameWorksheetRunSnapshot(ApiModel):
    id: str
    template_id: str
    user_id: str
    selected_instructor_id: str | None = None
    status: GameWorksheetRunStatus
    template: GameWorksheetTemplate
    artifacts: list[GameLessonArtifact]
    created_at: str
    updated_at: str


class GameWorksheetRunCreateRequest(ApiModel):
    selected_instructor_id: str | None = None


class GameLessonRunStageRequest(ApiModel):
    force: bool = False


class GameLessonArtifactApprovalRequest(ApiModel):
    decision: GameLessonApprovalDecision
    notes: str | None = None


class GameLessonArtifactApproval(ApiModel):
    id: str
    artifact_id: str
    run_id: str
    artifact_version: int
    user_id: str
    decision: GameLessonApprovalDecision
    notes: str | None = None
    created_at: str
