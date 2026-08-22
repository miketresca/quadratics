from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Protocol
from uuid import uuid4

import httpx

from app.core.config import Settings
from app.schemas.game_lessons import (
    GameLessonArtifact,
    GameLessonArtifactApproval,
    GameLessonArtifactApprovalRequest,
    GameLessonArtifactPayloadUpdateRequest,
    GameLessonArtifactStatus,
    GameLessonRunStageRequest,
    GameLessonStage,
    GameWorksheetRunCreateRequest,
    GameWorksheetRunSnapshot,
    GameWorksheetTemplate,
)
from app.services.game_lessons.costs import GameUsageCostRepository
from app.services.game_lessons.providers import (
    GameLessonNarrationStageProvider,
    GameLessonProviderResult,
    GameLessonProviderRuntimeError,
    GameLessonStageProvider,
)
from app.services.game_lessons.templates import VOLUME_CUBES_LESSON_1_TEMPLATE

TEMPLATE_ID = "volume-cubes-lesson-1"
STAGE_ORDER: tuple[str, ...] = (
    "template",
    "section_script",
    "speech_markup",
    "narration",
    "handwriting",
    "interactive_bundle",
    "lesson_publish",
)
STAGE_DEPENDENCIES: dict[str, tuple[str, ...]] = {
    "template": (),
    "section_script": ("template",),
    "speech_markup": ("section_script",),
    "narration": ("speech_markup",),
    "handwriting": ("narration",),
    "interactive_bundle": ("handwriting",),
    "lesson_publish": ("interactive_bundle",),
}
APPROVAL_REQUIRED_STAGES = {"section_script", "speech_markup"}
EDITABLE_PAYLOAD_STAGES = {"section_script", "speech_markup"}
APPROVED_UPSTREAM_REQUIRED: dict[str, tuple[str, ...]] = {
    "speech_markup": ("section_script",),
    "narration": ("speech_markup",),
}
_TEMPLATE_COLUMNS = "id,title,version,payload"
_RUN_COLUMNS = "id,user_id,template_id,selected_instructor_id,status,metadata,created_at,updated_at"
_ARTIFACT_COLUMNS = (
    "id,run_id,stage,version,status,is_current,payload,storage_refs,error_message,"
    "stale_reason,config_metadata,created_at,updated_at"
)
_APPROVAL_COLUMNS = "id,artifact_id,run_id,artifact_version,user_id,decision,notes,created_at"


class GameLessonError(RuntimeError):
    pass


class GameLessonStorageError(GameLessonError):
    pass


class GameLessonTemplateNotFound(GameLessonError):
    pass


class GameLessonRunNotFound(GameLessonError):
    pass


class GameLessonArtifactNotFound(GameLessonError):
    pass


class GameLessonStageBlocked(GameLessonError):
    pass


class GameLessonRepository(Protocol):
    async def create_or_get_run(
        self,
        user_id: str,
        template_id: str,
        request: GameWorksheetRunCreateRequest,
    ) -> GameWorksheetRunSnapshot: ...

    async def get_run(self, user_id: str, run_id: str) -> GameWorksheetRunSnapshot: ...

    async def run_stage(
        self,
        user_id: str,
        run_id: str,
        stage: GameLessonStage,
        request: GameLessonRunStageRequest,
    ) -> GameWorksheetRunSnapshot: ...

    async def approve_artifact(
        self,
        user_id: str,
        artifact_id: str,
        request: GameLessonArtifactApprovalRequest,
    ) -> GameLessonArtifactApproval: ...

    async def update_artifact_payload(
        self,
        user_id: str,
        artifact_id: str,
        request: GameLessonArtifactPayloadUpdateRequest,
    ) -> GameWorksheetRunSnapshot: ...


@dataclass
class _StoredRun:
    id: str
    user_id: str
    template_id: str
    selected_instructor_id: str | None
    status: str
    metadata: dict[str, Any]
    created_at: str
    updated_at: str


@dataclass
class _StoredArtifact:
    id: str
    run_id: str
    stage: str
    version: int
    status: GameLessonArtifactStatus
    is_current: bool
    payload: dict[str, Any]
    storage_refs: list[dict[str, Any]]
    error_message: str | None
    stale_reason: str | None
    config_metadata: dict[str, Any]
    created_at: str
    updated_at: str


@dataclass
class _StoredApproval:
    id: str
    artifact_id: str
    run_id: str
    artifact_version: int
    user_id: str
    decision: str
    notes: str | None
    created_at: str


@dataclass
class InMemoryGameLessonRepository:
    _templates: dict[str, GameWorksheetTemplate] = field(default_factory=dict)
    _runs: dict[str, _StoredRun] = field(default_factory=dict)
    _artifacts: dict[str, _StoredArtifact] = field(default_factory=dict)
    _approvals: dict[tuple[str, int], _StoredApproval] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if TEMPLATE_ID not in self._templates:
            self._templates[TEMPLATE_ID] = VOLUME_CUBES_LESSON_1_TEMPLATE.model_copy(deep=True)

    async def create_or_get_run(
        self,
        user_id: str,
        template_id: str,
        request: GameWorksheetRunCreateRequest,
    ) -> GameWorksheetRunSnapshot:
        self._template(template_id)
        for run in self._runs.values():
            if (
                run.user_id == user_id
                and run.template_id == template_id
                and run.selected_instructor_id == request.selected_instructor_id
            ):
                return self._snapshot(run)
        now = _now()
        run = _StoredRun(
            id=str(uuid4()),
            user_id=user_id,
            template_id=template_id,
            selected_instructor_id=request.selected_instructor_id,
            status="active",
            metadata={},
            created_at=now,
            updated_at=now,
        )
        self._runs[run.id] = run
        return self._snapshot(run)

    async def get_run(self, user_id: str, run_id: str) -> GameWorksheetRunSnapshot:
        return self._snapshot(self._run_for_user(user_id, run_id))

    async def run_stage(
        self,
        user_id: str,
        run_id: str,
        stage: GameLessonStage,
        request: GameLessonRunStageRequest,
    ) -> GameWorksheetRunSnapshot:
        run = self._run_for_user(user_id, run_id)
        self._validate_stage(stage)
        if stage != "template":
            self._assert_upstream_ready(run.id, stage)
        current = self._current_artifact(run.id, stage)
        if current and current.status in ("completed", "approved") and not request.force:
            return self._snapshot(run)
        try:
            self._create_artifact(run, stage)
        except GameLessonProviderRuntimeError as exc:
            self._create_failed_artifact(run, stage, exc)
            raise
        self._mark_descendants_stale(run.id, stage)
        if stage == "lesson_publish":
            run.status = "completed"
        run.updated_at = _now()
        return self._snapshot(run)

    async def approve_artifact(
        self,
        user_id: str,
        artifact_id: str,
        request: GameLessonArtifactApprovalRequest,
    ) -> GameLessonArtifactApproval:
        artifact = self._artifact_for_user(user_id, artifact_id)
        if not artifact.is_current:
            raise GameLessonStageBlocked("Only the current artifact version can be approved")
        if artifact.status not in ("completed", "awaiting_approval", "approved", "rejected"):
            raise GameLessonStageBlocked("Artifact is not ready for approval")
        artifact.status = request.decision
        artifact.updated_at = _now()
        approval = _StoredApproval(
            id=str(uuid4()),
            artifact_id=artifact.id,
            run_id=artifact.run_id,
            artifact_version=artifact.version,
            user_id=user_id,
            decision=request.decision,
            notes=request.notes,
            created_at=_now(),
        )
        self._approvals[(artifact.id, artifact.version)] = approval
        return _approval_to_response(approval)

    async def update_artifact_payload(
        self,
        user_id: str,
        artifact_id: str,
        request: GameLessonArtifactPayloadUpdateRequest,
    ) -> GameWorksheetRunSnapshot:
        artifact = self._artifact_for_user(user_id, artifact_id)
        if not artifact.is_current:
            raise GameLessonStageBlocked("Only the current artifact version can be edited")
        if artifact.stage not in EDITABLE_PAYLOAD_STAGES:
            raise GameLessonStageBlocked(f"{artifact.stage} cannot be edited manually")
        run = self._run_for_user(user_id, artifact.run_id)
        now = _now()
        artifact.is_current = False
        artifact.updated_at = now
        payload = _editable_payload_for_stage(artifact.stage, request.payload)
        next_artifact = _StoredArtifact(
            id=str(uuid4()),
            run_id=run.id,
            stage=artifact.stage,
            version=self._next_artifact_version(run.id, artifact.stage),
            status="approved",
            is_current=True,
            payload=payload,
            storage_refs=artifact.storage_refs,
            error_message=None,
            stale_reason=None,
            config_metadata={
                **artifact.config_metadata,
                "provider": "manual",
                "source": "game_lesson_pipeline_editor",
                "manualEditOfArtifactId": artifact.id,
                "manualEditNotes": request.notes,
                "stageInput": artifact.config_metadata.get(
                    "stageInput",
                    self._stage_input_for_stage(run, artifact.stage),
                ),
                "stageOutput": payload,
            },
            created_at=now,
            updated_at=now,
        )
        self._artifacts[next_artifact.id] = next_artifact
        self._mark_descendants_stale(run.id, artifact.stage)
        run.updated_at = now
        run.status = "active"
        return self._snapshot(run)

    def _create_artifact(self, run: _StoredRun, stage: str) -> _StoredArtifact:
        now = _now()
        current = self._current_artifact(run.id, stage)
        next_version = self._next_artifact_version(run.id, stage)
        payload = self._payload_for_stage(run, stage)
        if current:
            current.is_current = False
            current.updated_at = now
        artifact = _StoredArtifact(
            id=str(uuid4()),
            run_id=run.id,
            stage=stage,
            version=next_version,
            status=_status_for_stage(stage),
            is_current=True,
            payload=payload,
            storage_refs=[],
            error_message=None,
            stale_reason=None,
            config_metadata={
                "provider": "deterministic",
                "source": "game_lesson_repository",
                "stageInput": self._stage_input_for_stage(run, stage),
                "stageOutput": payload,
            },
            created_at=now,
            updated_at=now,
        )
        self._artifacts[artifact.id] = artifact
        return artifact

    def _create_failed_artifact(
        self,
        run: _StoredRun,
        stage: str,
        error: GameLessonProviderRuntimeError,
    ) -> _StoredArtifact:
        now = _now()
        current = self._current_artifact(run.id, stage)
        next_version = self._next_artifact_version(run.id, stage)
        payload = {
            "summary": f"{stage} failed",
            "provider": error.provider,
            "stage": error.stage,
            "upstreamStatusCode": error.upstream_status_code,
        }
        if current:
            current.is_current = False
            current.updated_at = now
        artifact = _StoredArtifact(
            id=str(uuid4()),
            run_id=run.id,
            stage=stage,
            version=next_version,
            status="failed",
            is_current=True,
            payload=payload,
            storage_refs=[],
            error_message=str(error),
            stale_reason=None,
            config_metadata={
                "provider": error.provider,
                "source": "game_lesson_repository",
                "upstreamStatusCode": error.upstream_status_code,
                "stageInput": self._stage_input_for_stage(run, stage),
                "stageOutput": payload,
            },
            created_at=now,
            updated_at=now,
        )
        self._artifacts[artifact.id] = artifact
        return artifact

    def _payload_for_stage(self, run: _StoredRun, stage: str) -> dict[str, Any]:
        template_payload = self._template(run.template_id).payload
        if stage == "template":
            return _template_artifact_payload(run.template_id, self._template(run.template_id))
        if stage == "section_script":
            return _section_script_payload(template_payload)
        if stage == "speech_markup":
            section_script = self._current_artifact(run.id, "section_script")
            return _speech_markup_payload(section_script.payload if section_script else {})
        if stage == "narration":
            speech_markup = self._current_artifact(run.id, "speech_markup")
            return _narration_payload(run, speech_markup.payload if speech_markup else {})
        if stage == "handwriting":
            narration = self._current_artifact(run.id, "narration")
            return _handwriting_payload(template_payload, narration.payload if narration else {})
        if stage == "interactive_bundle":
            narration = self._current_artifact(run.id, "narration")
            handwriting = self._current_artifact(run.id, "handwriting")
            return _interactive_bundle_payload(
                run,
                template_payload,
                narration.payload if narration else {},
                handwriting.payload if handwriting else {},
            )
        if stage == "lesson_publish":
            interactive_bundle = self._current_artifact(run.id, "interactive_bundle")
            return _lesson_publish_payload(
                run,
                template_payload,
                interactive_bundle,
            )
        return {"stage": stage}

    def _stage_input_for_stage(self, run: _StoredRun, stage: str) -> dict[str, Any]:
        template_payload = self._template(run.template_id).payload
        if stage == "template":
            return {"templateId": run.template_id, "template": template_payload}
        if stage == "section_script":
            return {
                "selectedInstructorId": run.selected_instructor_id,
                "template": template_payload,
            }
        if stage == "speech_markup":
            section_script = self._current_artifact(run.id, "section_script")
            return {"sectionScript": section_script.payload if section_script else None}
        if stage == "narration":
            speech_markup = self._current_artifact(run.id, "speech_markup")
            return {
                "selectedInstructorId": run.selected_instructor_id,
                "speechMarkup": speech_markup.payload if speech_markup else None,
            }
        if stage == "handwriting":
            narration = self._current_artifact(run.id, "narration")
            return {
                "template": template_payload,
                "narration": narration.payload if narration else None,
            }
        if stage == "interactive_bundle":
            narration = self._current_artifact(run.id, "narration")
            handwriting = self._current_artifact(run.id, "handwriting")
            return {
                "template": template_payload,
                "narration": narration.payload if narration else None,
                "handwriting": handwriting.payload if handwriting else None,
            }
        if stage == "lesson_publish":
            interactive_bundle = self._current_artifact(run.id, "interactive_bundle")
            return {
                "template": template_payload,
                "interactiveBundle": interactive_bundle.payload if interactive_bundle else None,
            }
        return {"stage": stage}

    def _assert_upstream_ready(self, run_id: str, stage: str) -> None:
        for upstream_stage in APPROVED_UPSTREAM_REQUIRED.get(stage, ()):
            upstream = self._current_artifact(run_id, upstream_stage)
            if upstream is None or upstream.status != "approved":
                raise GameLessonStageBlocked(f"{stage} requires approved {upstream_stage}")
        for upstream_stage in STAGE_DEPENDENCIES[stage]:
            upstream = self._current_artifact(run_id, upstream_stage)
            if upstream is None or upstream.status not in ("completed", "approved"):
                raise GameLessonStageBlocked(f"{stage} requires completed {upstream_stage}")

    def _mark_descendants_stale(self, run_id: str, stage: str) -> None:
        stage_index = STAGE_ORDER.index(stage)
        descendants = set(STAGE_ORDER[stage_index + 1 :])
        for artifact in self._artifacts.values():
            if (
                artifact.run_id != run_id
                or artifact.stage not in descendants
                or not artifact.is_current
            ):
                continue
            artifact.status = "stale"
            artifact.is_current = False
            artifact.stale_reason = f"{stage} was regenerated"
            artifact.updated_at = _now()

    def _template(self, template_id: str) -> GameWorksheetTemplate:
        template = self._templates.get(template_id)
        if template is None:
            raise GameLessonTemplateNotFound("Unknown game worksheet template")
        return _canonical_template_if_needed(template)

    def _run_for_user(self, user_id: str, run_id: str) -> _StoredRun:
        run = self._runs.get(run_id)
        if run is None or run.user_id != user_id:
            raise GameLessonRunNotFound("Game worksheet run not found")
        return run

    def _artifact_for_user(self, user_id: str, artifact_id: str) -> _StoredArtifact:
        artifact = self._artifacts.get(artifact_id)
        if artifact is None:
            raise GameLessonArtifactNotFound("Game lesson artifact not found")
        self._run_for_user(user_id, artifact.run_id)
        return artifact

    def _current_artifact(self, run_id: str, stage: str) -> _StoredArtifact | None:
        candidates = [
            artifact
            for artifact in self._artifacts.values()
            if artifact.run_id == run_id and artifact.stage == stage and artifact.is_current
        ]
        return max(candidates, key=lambda artifact: artifact.version) if candidates else None

    def _next_artifact_version(self, run_id: str, stage: str) -> int:
        versions = [
            artifact.version
            for artifact in self._artifacts.values()
            if artifact.run_id == run_id and artifact.stage == stage
        ]
        return (max(versions) + 1) if versions else 1

    def _validate_stage(self, stage: str) -> None:
        if stage not in STAGE_ORDER:
            raise GameLessonStageBlocked("Unknown game lesson stage")

    def _snapshot(self, run: _StoredRun) -> GameWorksheetRunSnapshot:
        artifacts = sorted(
            [artifact for artifact in self._artifacts.values() if artifact.run_id == run.id],
            key=lambda artifact: (STAGE_ORDER.index(artifact.stage), artifact.version),
        )
        return GameWorksheetRunSnapshot(
            id=run.id,
            template_id=run.template_id,
            user_id=run.user_id,
            selected_instructor_id=run.selected_instructor_id,
            status=run.status,
            template=self._template(run.template_id),
            artifacts=[_artifact_to_response(artifact) for artifact in artifacts],
            created_at=run.created_at,
            updated_at=run.updated_at,
        )


class SupabaseGameLessonRepository(InMemoryGameLessonRepository):
    def __init__(
        self,
        settings: Settings,
        *,
        stage_provider: GameLessonStageProvider | None = None,
        narration_provider: GameLessonNarrationStageProvider | None = None,
        usage_costs: GameUsageCostRepository | None = None,
    ) -> None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise GameLessonStorageError("Supabase game lesson storage is not configured")
        self._base_url = settings.supabase_url.rstrip("/")
        self._headers = {
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": "application/json",
        }
        self._stage_provider = stage_provider
        self._narration_provider = narration_provider
        self._usage_costs = usage_costs

    async def create_or_get_run(
        self,
        user_id: str,
        template_id: str,
        request: GameWorksheetRunCreateRequest,
    ) -> GameWorksheetRunSnapshot:
        await self._get_template(template_id)
        existing = await self._find_run(user_id, template_id, request.selected_instructor_id)
        if existing is not None:
            return await self._snapshot(existing)
        payload = {
            "user_id": user_id,
            "template_id": template_id,
            "selected_instructor_id": request.selected_instructor_id,
            "status": "active",
            "metadata": {},
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self._base_url}/rest/v1/game_worksheet_runs",
                headers={**self._headers, "Prefer": "return=representation"},
                params={"select": _RUN_COLUMNS},
                json=payload,
            )
        _raise_for_storage_error(response)
        rows = response.json()
        if not rows:
            raise GameLessonStorageError("Game worksheet run was not returned after create")
        return await self._snapshot(_run_from_row(rows[0]))

    async def get_run(self, user_id: str, run_id: str) -> GameWorksheetRunSnapshot:
        return await self._snapshot(await self._get_run_for_user(user_id, run_id))

    async def run_stage(
        self,
        user_id: str,
        run_id: str,
        stage: GameLessonStage,
        request: GameLessonRunStageRequest,
    ) -> GameWorksheetRunSnapshot:
        run = await self._get_run_for_user(user_id, run_id)
        self._validate_stage(stage)
        if stage != "template":
            await self._assert_upstream_ready(run.id, stage)
        current = await self._current_artifact(run.id, stage)
        if current and current.status in ("completed", "approved") and not request.force:
            return await self._snapshot(run)
        try:
            await self._create_artifact(run, stage)
        except GameLessonProviderRuntimeError as exc:
            await self._create_failed_artifact(run, stage, exc)
            raise
        await self._mark_descendants_stale(run.id, stage)
        run_status = "completed" if stage == "lesson_publish" else None
        await self._touch_run(run.id, status_value=run_status)
        return await self._snapshot(await self._get_run_for_user(user_id, run.id))

    async def approve_artifact(
        self,
        user_id: str,
        artifact_id: str,
        request: GameLessonArtifactApprovalRequest,
    ) -> GameLessonArtifactApproval:
        artifact = await self._get_artifact_for_user(user_id, artifact_id)
        if not artifact.is_current:
            raise GameLessonStageBlocked("Only the current artifact version can be approved")
        if artifact.status not in ("completed", "awaiting_approval", "approved", "rejected"):
            raise GameLessonStageBlocked("Artifact is not ready for approval")
        async with httpx.AsyncClient() as client:
            patch_response = await client.patch(
                f"{self._base_url}/rest/v1/game_lesson_artifacts",
                headers={**self._headers, "Prefer": "return=representation"},
                params={"id": f"eq.{artifact.id}", "select": "id"},
                json={"status": request.decision, "updated_at": _now()},
            )
            _raise_for_storage_error(patch_response)
            approval_response = await client.post(
                f"{self._base_url}/rest/v1/game_lesson_artifact_approvals",
                headers={
                    **self._headers,
                    "Prefer": "resolution=merge-duplicates,return=representation",
                },
                params={
                    "on_conflict": "artifact_id,artifact_version",
                    "select": _APPROVAL_COLUMNS,
                },
                json={
                    "artifact_id": artifact.id,
                    "run_id": artifact.run_id,
                    "artifact_version": artifact.version,
                    "user_id": user_id,
                    "decision": request.decision,
                    "notes": request.notes,
                },
            )
        _raise_for_storage_error(approval_response)
        rows = approval_response.json()
        if not rows:
            raise GameLessonStorageError("Game lesson approval was not returned after save")
        return _approval_to_response(_approval_from_row(rows[0]))

    async def update_artifact_payload(
        self,
        user_id: str,
        artifact_id: str,
        request: GameLessonArtifactPayloadUpdateRequest,
    ) -> GameWorksheetRunSnapshot:
        artifact = await self._get_artifact_for_user(user_id, artifact_id)
        if not artifact.is_current:
            raise GameLessonStageBlocked("Only the current artifact version can be edited")
        if artifact.stage not in EDITABLE_PAYLOAD_STAGES:
            raise GameLessonStageBlocked(f"{artifact.stage} cannot be edited manually")
        run = await self._get_run_for_user(user_id, artifact.run_id)
        now = _now()
        payload = _editable_payload_for_stage(artifact.stage, request.payload)
        config_metadata = {
            **artifact.config_metadata,
            "provider": "manual",
            "source": "game_lesson_pipeline_editor",
            "manualEditOfArtifactId": artifact.id,
            "manualEditNotes": request.notes,
            "stageInput": artifact.config_metadata.get("stageInput")
            or await self._stage_input_for_storage(run, artifact.stage),
            "stageOutput": payload,
        }
        async with httpx.AsyncClient() as client:
            current_response = await client.patch(
                f"{self._base_url}/rest/v1/game_lesson_artifacts",
                headers=self._headers,
                params={"id": f"eq.{artifact.id}"},
                json={"is_current": False, "updated_at": now},
            )
            _raise_for_storage_error(current_response)
            create_response = await client.post(
                f"{self._base_url}/rest/v1/game_lesson_artifacts",
                headers={**self._headers, "Prefer": "return=representation"},
                params={"select": _ARTIFACT_COLUMNS},
                json={
                    "run_id": run.id,
                    "stage": artifact.stage,
                    "version": await self._next_artifact_version(run.id, artifact.stage),
                    "status": "approved",
                    "is_current": True,
                    "payload": payload,
                    "storage_refs": artifact.storage_refs,
                    "config_metadata": config_metadata,
                },
            )
        _raise_for_storage_error(create_response)
        rows = create_response.json()
        if not rows:
            raise GameLessonStorageError("Game lesson artifact was not returned after edit")
        await self._mark_descendants_stale(run.id, artifact.stage)
        await self._touch_run(run.id, status_value="active")
        return await self._snapshot(await self._get_run_for_user(user_id, run.id))

    async def _find_run(
        self,
        user_id: str,
        template_id: str,
        selected_instructor_id: str | None,
    ) -> _StoredRun | None:
        params = {
            "user_id": f"eq.{user_id}",
            "template_id": f"eq.{template_id}",
            "select": _RUN_COLUMNS,
            "limit": "1",
        }
        if selected_instructor_id is None:
            params["selected_instructor_id"] = "is.null"
        else:
            params["selected_instructor_id"] = f"eq.{selected_instructor_id}"
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self._base_url}/rest/v1/game_worksheet_runs",
                headers=self._headers,
                params=params,
            )
        _raise_for_storage_error(response)
        rows = response.json()
        return _run_from_row(rows[0]) if rows else None

    async def _get_run_for_user(self, user_id: str, run_id: str) -> _StoredRun:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self._base_url}/rest/v1/game_worksheet_runs",
                headers=self._headers,
                params={
                    "id": f"eq.{run_id}",
                    "user_id": f"eq.{user_id}",
                    "select": _RUN_COLUMNS,
                    "limit": "1",
                },
            )
        _raise_for_storage_error(response)
        rows = response.json()
        if not rows:
            raise GameLessonRunNotFound("Game worksheet run not found")
        return _run_from_row(rows[0])

    async def _get_template(self, template_id: str) -> GameWorksheetTemplate:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self._base_url}/rest/v1/game_worksheet_templates",
                headers=self._headers,
                params={
                    "id": f"eq.{template_id}",
                    "select": _TEMPLATE_COLUMNS,
                    "limit": "1",
                },
            )
        _raise_for_storage_error(response)
        rows = response.json()
        if not rows:
            raise GameLessonTemplateNotFound("Unknown game worksheet template")
        return _canonical_template_if_needed(GameWorksheetTemplate.model_validate(rows[0]))

    async def _list_artifacts(self, run_id: str) -> list[_StoredArtifact]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self._base_url}/rest/v1/game_lesson_artifacts",
                headers=self._headers,
                params={
                    "run_id": f"eq.{run_id}",
                    "select": _ARTIFACT_COLUMNS,
                    "order": "created_at.asc",
                },
            )
        _raise_for_storage_error(response)
        return [_artifact_from_row(row) for row in response.json()]

    async def _current_artifact(self, run_id: str, stage: str) -> _StoredArtifact | None:  # type: ignore[override]
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self._base_url}/rest/v1/game_lesson_artifacts",
                headers=self._headers,
                params={
                    "run_id": f"eq.{run_id}",
                    "stage": f"eq.{stage}",
                    "is_current": "eq.true",
                    "select": _ARTIFACT_COLUMNS,
                    "limit": "1",
                },
            )
        _raise_for_storage_error(response)
        rows = response.json()
        return _artifact_from_row(rows[0]) if rows else None

    async def _next_artifact_version(self, run_id: str, stage: str) -> int:  # type: ignore[override]
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self._base_url}/rest/v1/game_lesson_artifacts",
                headers=self._headers,
                params={
                    "run_id": f"eq.{run_id}",
                    "stage": f"eq.{stage}",
                    "select": "version",
                    "order": "version.desc",
                    "limit": "1",
                },
            )
        _raise_for_storage_error(response)
        rows = response.json()
        return int(rows[0]["version"]) + 1 if rows else 1

    async def _get_artifact_for_user(self, user_id: str, artifact_id: str) -> _StoredArtifact:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self._base_url}/rest/v1/game_lesson_artifacts",
                headers=self._headers,
                params={"id": f"eq.{artifact_id}", "select": _ARTIFACT_COLUMNS, "limit": "1"},
            )
        _raise_for_storage_error(response)
        rows = response.json()
        if not rows:
            raise GameLessonArtifactNotFound("Game lesson artifact not found")
        artifact = _artifact_from_row(rows[0])
        await self._get_run_for_user(user_id, artifact.run_id)
        return artifact

    async def _create_artifact(self, run: _StoredRun, stage: str) -> _StoredArtifact:  # type: ignore[override]
        current = await self._current_artifact(run.id, stage)
        next_version = await self._next_artifact_version(run.id, stage)
        generated = await self._generated_stage_from_storage(run, stage)
        generated = await self._with_stage_io_from_storage(run, stage, generated)
        async with httpx.AsyncClient() as client:
            if current:
                current_response = await client.patch(
                    f"{self._base_url}/rest/v1/game_lesson_artifacts",
                    headers=self._headers,
                    params={"id": f"eq.{current.id}"},
                    json={"is_current": False, "updated_at": _now()},
                )
                _raise_for_storage_error(current_response)
            create_response = await client.post(
                f"{self._base_url}/rest/v1/game_lesson_artifacts",
                headers={**self._headers, "Prefer": "return=representation"},
                params={"select": _ARTIFACT_COLUMNS},
                json={
                    "run_id": run.id,
                    "stage": stage,
                    "version": next_version,
                    "status": _status_for_stage(stage),
                    "is_current": True,
                    "payload": generated.payload,
                    "storage_refs": generated.storage_refs,
                    "config_metadata": generated.config_metadata,
                },
            )
        _raise_for_storage_error(create_response)
        rows = create_response.json()
        if not rows:
            raise GameLessonStorageError("Game lesson artifact was not returned after create")
        artifact = _artifact_from_row(rows[0])
        await self._record_usage(run, artifact, generated)
        return artifact

    async def _create_failed_artifact(
        self,
        run: _StoredRun,
        stage: str,
        error: GameLessonProviderRuntimeError,
    ) -> _StoredArtifact:
        current = await self._current_artifact(run.id, stage)
        next_version = await self._next_artifact_version(run.id, stage)
        payload = {
            "summary": f"{stage} failed",
            "provider": error.provider,
            "stage": error.stage,
            "upstreamStatusCode": error.upstream_status_code,
        }
        config_metadata = {
            "provider": error.provider,
            "source": "game_lesson_repository",
            "upstreamStatusCode": error.upstream_status_code,
            "stageInput": await self._stage_input_for_storage(run, stage),
            "stageOutput": payload,
        }
        async with httpx.AsyncClient() as client:
            if current:
                current_response = await client.patch(
                    f"{self._base_url}/rest/v1/game_lesson_artifacts",
                    headers=self._headers,
                    params={"id": f"eq.{current.id}"},
                    json={"is_current": False, "updated_at": _now()},
                )
                _raise_for_storage_error(current_response)
            create_response = await client.post(
                f"{self._base_url}/rest/v1/game_lesson_artifacts",
                headers={**self._headers, "Prefer": "return=representation"},
                params={"select": _ARTIFACT_COLUMNS},
                json={
                    "run_id": run.id,
                    "stage": stage,
                    "version": next_version,
                    "status": "failed",
                    "is_current": True,
                    "payload": payload,
                    "storage_refs": [],
                    "error_message": str(error),
                    "config_metadata": config_metadata,
                },
            )
        _raise_for_storage_error(create_response)
        rows = create_response.json()
        if not rows:
            raise GameLessonStorageError(
                "Failed game lesson artifact was not returned after create"
            )
        return _artifact_from_row(rows[0])

    async def _generated_stage_from_storage(
        self,
        run: _StoredRun,
        stage: str,
    ) -> GameLessonProviderResult:
        template = await self._get_template(run.template_id)
        if self._stage_provider is not None and stage == "section_script":
            return await self._stage_provider.generate_section_script(
                template_payload=template.payload,
                selected_instructor_id=run.selected_instructor_id,
            )
        if self._stage_provider is not None and stage == "speech_markup":
            section_script = await self._current_artifact(run.id, "section_script")
            return await self._stage_provider.generate_speech_markup(
                section_script_payload=section_script.payload if section_script else {},
            )
        if self._narration_provider is not None and stage == "narration":
            speech_markup = await self._current_artifact(run.id, "speech_markup")
            return await self._narration_provider.generate_narration(
                user_id=run.user_id,
                run_id=run.id,
                selected_instructor_id=run.selected_instructor_id,
                speech_markup_payload=speech_markup.payload if speech_markup else {},
            )
        return GameLessonProviderResult(
            payload=await self._payload_for_stage_from_storage(run, stage),
            config_metadata={
                "provider": "deterministic",
                "source": "game_lesson_repository",
            },
        )

    async def _with_stage_io_from_storage(
        self,
        run: _StoredRun,
        stage: str,
        generated: GameLessonProviderResult,
    ) -> GameLessonProviderResult:
        config_metadata = dict(generated.config_metadata)
        config_metadata.setdefault("stageInput", await self._stage_input_for_storage(run, stage))
        config_metadata.setdefault("stageOutput", generated.payload)
        return GameLessonProviderResult(
            payload=generated.payload,
            config_metadata=config_metadata,
            usage_records=generated.usage_records,
            storage_refs=generated.storage_refs,
        )

    async def _record_usage(
        self,
        run: _StoredRun,
        artifact: _StoredArtifact,
        generated: GameLessonProviderResult,
    ) -> None:
        if self._usage_costs is None:
            return
        for record in generated.usage_records:
            await self._usage_costs.record(
                user_id=run.user_id,
                run_id=run.id,
                artifact_id=artifact.id,
                stage=artifact.stage,
                provider=record.provider,
                model=record.model,
                unit_type=record.unit_type,
                quantity=record.quantity,
                unit_cost_usd=record.unit_cost_usd,
                metadata=record.metadata,
            )

    async def _payload_for_stage_from_storage(self, run: _StoredRun, stage: str) -> dict[str, Any]:
        template = await self._get_template(run.template_id)
        if stage == "template":
            return _template_artifact_payload(run.template_id, template)
        if stage == "section_script":
            return _section_script_payload(template.payload)
        if stage == "speech_markup":
            section_script = await self._current_artifact(run.id, "section_script")
            return _speech_markup_payload(section_script.payload if section_script else {})
        if stage == "narration":
            speech_markup = await self._current_artifact(run.id, "speech_markup")
            return _narration_payload(run, speech_markup.payload if speech_markup else {})
        if stage == "handwriting":
            narration = await self._current_artifact(run.id, "narration")
            return _handwriting_payload(template.payload, narration.payload if narration else {})
        if stage == "interactive_bundle":
            narration = await self._current_artifact(run.id, "narration")
            handwriting = await self._current_artifact(run.id, "handwriting")
            return _interactive_bundle_payload(
                run,
                template.payload,
                narration.payload if narration else {},
                handwriting.payload if handwriting else {},
            )
        if stage == "lesson_publish":
            interactive_bundle = await self._current_artifact(run.id, "interactive_bundle")
            return _lesson_publish_payload(
                run,
                template.payload,
                interactive_bundle,
            )
        return {"stage": stage}

    async def _stage_input_for_storage(self, run: _StoredRun, stage: str) -> dict[str, Any]:
        template = await self._get_template(run.template_id)
        if stage == "template":
            return {"templateId": run.template_id, "template": template.payload}
        if stage == "section_script":
            return {
                "selectedInstructorId": run.selected_instructor_id,
                "template": template.payload,
            }
        if stage == "speech_markup":
            section_script = await self._current_artifact(run.id, "section_script")
            return {"sectionScript": section_script.payload if section_script else None}
        if stage == "narration":
            speech_markup = await self._current_artifact(run.id, "speech_markup")
            return {
                "selectedInstructorId": run.selected_instructor_id,
                "speechMarkup": speech_markup.payload if speech_markup else None,
            }
        if stage == "handwriting":
            narration = await self._current_artifact(run.id, "narration")
            return {
                "template": template.payload,
                "narration": narration.payload if narration else None,
            }
        if stage == "interactive_bundle":
            narration = await self._current_artifact(run.id, "narration")
            handwriting = await self._current_artifact(run.id, "handwriting")
            return {
                "template": template.payload,
                "narration": narration.payload if narration else None,
                "handwriting": handwriting.payload if handwriting else None,
            }
        if stage == "lesson_publish":
            interactive_bundle = await self._current_artifact(run.id, "interactive_bundle")
            return {
                "template": template.payload,
                "interactiveBundle": interactive_bundle.payload if interactive_bundle else None,
            }
        return {"stage": stage}

    async def _assert_upstream_ready(self, run_id: str, stage: str) -> None:  # type: ignore[override]
        for upstream_stage in APPROVED_UPSTREAM_REQUIRED.get(stage, ()):
            upstream = await self._current_artifact(run_id, upstream_stage)
            if upstream is None or upstream.status != "approved":
                raise GameLessonStageBlocked(f"{stage} requires approved {upstream_stage}")
        for upstream_stage in STAGE_DEPENDENCIES[stage]:
            upstream = await self._current_artifact(run_id, upstream_stage)
            if upstream is None or upstream.status not in ("completed", "approved"):
                raise GameLessonStageBlocked(f"{stage} requires completed {upstream_stage}")

    async def _mark_descendants_stale(self, run_id: str, stage: str) -> None:  # type: ignore[override]
        stage_index = STAGE_ORDER.index(stage)
        descendants = STAGE_ORDER[stage_index + 1 :]
        async with httpx.AsyncClient() as client:
            for descendant in descendants:
                response = await client.patch(
                    f"{self._base_url}/rest/v1/game_lesson_artifacts",
                    headers=self._headers,
                    params={
                        "run_id": f"eq.{run_id}",
                        "stage": f"eq.{descendant}",
                        "is_current": "eq.true",
                    },
                    json={
                        "status": "stale",
                        "is_current": False,
                        "stale_reason": f"{stage} was regenerated",
                        "updated_at": _now(),
                    },
                )
                _raise_for_storage_error(response)

    async def _touch_run(self, run_id: str, *, status_value: str | None = None) -> None:
        payload: dict[str, Any] = {"updated_at": _now()}
        if status_value is not None:
            payload["status"] = status_value
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{self._base_url}/rest/v1/game_worksheet_runs",
                headers=self._headers,
                params={"id": f"eq.{run_id}"},
                json=payload,
            )
        _raise_for_storage_error(response)

    async def _snapshot(self, run: _StoredRun) -> GameWorksheetRunSnapshot:  # type: ignore[override]
        template = await self._get_template(run.template_id)
        artifacts = sorted(
            await self._list_artifacts(run.id),
            key=lambda artifact: (STAGE_ORDER.index(artifact.stage), artifact.version),
        )
        return GameWorksheetRunSnapshot(
            id=run.id,
            template_id=run.template_id,
            user_id=run.user_id,
            selected_instructor_id=run.selected_instructor_id,
            status=run.status,  # type: ignore[arg-type]
            template=template,
            artifacts=[_artifact_to_response(artifact) for artifact in artifacts],
            created_at=run.created_at,
            updated_at=run.updated_at,
        )


def _status_for_stage(stage: str) -> GameLessonArtifactStatus:
    return "awaiting_approval" if stage in APPROVAL_REQUIRED_STAGES else "completed"


def _canonical_template_if_needed(template: GameWorksheetTemplate) -> GameWorksheetTemplate:
    if template.id != TEMPLATE_ID:
        return template
    # Lesson 1 is authored as a deterministic template in code so old persisted
    # template artifacts cannot keep serving stale worksheet coordinates.
    return VOLUME_CUBES_LESSON_1_TEMPLATE.model_copy(deep=True)


def _editable_payload_for_stage(stage: str, payload: dict[str, Any]) -> dict[str, Any]:
    if stage not in EDITABLE_PAYLOAD_STAGES:
        raise GameLessonStageBlocked(f"{stage} cannot be edited manually")
    sections = payload.get("sections")
    if not isinstance(sections, list) or not sections:
        raise GameLessonStageBlocked(f"{stage} edits require at least one section")
    required_text_key = "speechText" if stage == "speech_markup" else "narration"
    for section in sections:
        if not isinstance(section, dict):
            raise GameLessonStageBlocked(f"{stage} edits must keep section objects")
        if not str(section.get("sectionId") or section.get("id") or "").strip():
            raise GameLessonStageBlocked(f"{stage} edits must keep section IDs")
        if not str(section.get(required_text_key) or "").strip():
            raise GameLessonStageBlocked(f"{stage} edits must keep non-empty {required_text_key}")
    return payload


def _template_artifact_payload(template_id: str, template: GameWorksheetTemplate) -> dict[str, Any]:
    return {
        "summary": (
            "Manual worksheet map for Lesson 1, including page regions, questions, "
            "fill targets, and LLM guardrails."
        ),
        "templateId": template_id,
        "templateVersion": template.version,
        **template.payload,
    }


def _section_script_payload(template_payload: dict[str, Any]) -> dict[str, Any]:
    sections = []
    questions_by_section = _questions_by_section(template_payload)
    fill_targets_by_section = _fill_targets_by_section(template_payload)
    for section in template_payload.get("sections", []):
        if not isinstance(section, dict):
            continue
        section_id = str(section["id"])
        questions = questions_by_section.get(section_id, [])
        section_answers = [
            str(question["answer"]) for question in questions if "answer" in question
        ]
        sections.append(
            {
                "sectionId": section_id,
                "title": section["title"],
                "targetDurationSeconds": section.get("targetDurationSeconds", 45),
                "regionId": section.get("regionId"),
                "questionIds": [question["id"] for question in questions],
                "fillTargetIds": [
                    target["id"] for target in fill_targets_by_section.get(section_id, [])
                ],
                "narration": _section_narration(
                    section_id,
                    str(section["title"]),
                    section_answers,
                ),
                "approvalRequired": True,
            }
        )
    return {
        "summary": (
            "Draft narration script split by worksheet section. Review this before "
            "generating speech markup or audio."
        ),
        "scriptVersion": 1,
        "targetTotalSeconds": sum(
            int(section.get("targetDurationSeconds", 0)) for section in sections
        ),
        "audience": template_payload.get("studentAudience"),
        "sourceTemplateId": template_payload.get("templateId"),
        "sections": sections,
        "promptMetadata": {
            "provider": "deterministic",
            "promptSource": "apps/api/app/services/game_lessons/templates/volume_cubes_lesson_1.py",
            "guardrails": template_payload.get("guardrails", []),
        },
    }


def _speech_markup_payload(section_script_payload: dict[str, Any]) -> dict[str, Any]:
    sections = []
    for section in section_script_payload.get("sections", []):
        if not isinstance(section, dict):
            continue
        narration = str(section.get("narration", "")).strip()
        sections.append(
            {
                "sectionId": section.get("sectionId"),
                "sourceScriptSectionId": section.get("sectionId"),
                "targetDurationSeconds": section.get("targetDurationSeconds"),
                "speechText": _speech_ready_text(narration),
                "approvalRequired": True,
            }
        )
    return {
        "summary": "Provider-ready speech text with conservative pauses for ElevenLabs narration.",
        "markupVersion": 1,
        "sourceScriptVersion": section_script_payload.get("scriptVersion"),
        "sections": sections,
        "promptMetadata": {
            "provider": "deterministic",
            "guardrails": [
                "Keep each section independent so audio can be generated and replayed "
                "section by section.",
                "Use plain speech and pause tags only; do not add new math or worksheet answers.",
            ],
        },
    }


def _narration_payload(run: _StoredRun, speech_markup_payload: dict[str, Any]) -> dict[str, Any]:
    sections = []
    elapsed_seconds = 0.0
    for index, section in enumerate(speech_markup_payload.get("sections", []), start=1):
        if not isinstance(section, dict):
            continue
        speech_text = str(section.get("speechText", "")).strip()
        duration_seconds = _estimated_speech_duration_seconds(speech_text)
        section_id = str(section.get("sectionId", f"section_{index}"))
        sections.append(
            {
                "sectionId": section_id,
                "audioMode": "development_preview",
                "audioUrl": None,
                "storageRef": None,
                "speechText": speech_text,
                "durationSeconds": duration_seconds,
                "startSeconds": round(elapsed_seconds, 2),
                "endSeconds": round(elapsed_seconds + duration_seconds, 2),
                "alignment": _estimated_alignment(speech_text, elapsed_seconds, duration_seconds),
            }
        )
        elapsed_seconds += duration_seconds
    return {
        "summary": (
            "Development narration timeline generated from approved speech markup. "
            "ElevenLabs audio will replace these preview timings in the provider slice."
        ),
        "narrationVersion": 1,
        "provider": "development",
        "model": None,
        "selectedInstructorId": run.selected_instructor_id,
        "durationSeconds": round(elapsed_seconds, 2),
        "sections": sections,
    }


def _handwriting_payload(
    template_payload: dict[str, Any],
    narration_payload: dict[str, Any],
) -> dict[str, Any]:
    fill_targets = template_payload.get("fillTargets", [])
    if not isinstance(fill_targets, list) or not fill_targets:
        raise GameLessonStageBlocked("handwriting requires template fill targets")
    narration_sections = {
        str(section.get("sectionId")): section
        for section in narration_payload.get("sections", [])
        if isinstance(section, dict)
    }
    actions = []
    for target in fill_targets:
        if not isinstance(target, dict):
            continue
        section_id = str(target.get("sectionId"))
        section_timing = narration_sections.get(section_id, {})
        section_start = float(section_timing.get("startSeconds", 0))
        section_duration = float(section_timing.get("durationSeconds", 8))
        section_targets = [
            candidate
            for candidate in fill_targets
            if isinstance(candidate, dict) and str(candidate.get("sectionId")) == section_id
        ]
        target_index = max(_target_index(section_targets, str(target.get("id"))), 0)
        slot_duration = max(section_duration / max(len(section_targets), 1), 1.25)
        start_seconds = section_start + target_index * slot_duration
        text = str(target.get("expectedText", ""))
        actions.append(
            {
                "id": f"write_{target.get('id')}",
                "type": "write_text",
                "sectionId": section_id,
                "pageId": target.get("pageId"),
                "fillTargetId": target.get("id"),
                "text": text,
                "rect": target.get("rect"),
                "startSeconds": round(start_seconds, 2),
                "endSeconds": round(
                    start_seconds + max(min(len(text) * 0.055, slot_duration), 1.0),
                    2,
                ),
                "style": {
                    "fontFamily": "handwritten_pen",
                    "inkColor": "#1f4f8f",
                    "reveal": "left_to_right",
                },
            }
        )
    if not actions:
        raise GameLessonStageBlocked("handwriting produced no actions")
    return {
        "summary": (
            "Deterministic handwriting action plan mapped to worksheet fill targets "
            "and preview narration timings."
        ),
        "handwritingVersion": 1,
        "actions": actions,
    }


def _interactive_bundle_payload(
    run: _StoredRun,
    template_payload: dict[str, Any],
    narration_payload: dict[str, Any],
    handwriting_payload: dict[str, Any],
) -> dict[str, Any]:
    pages = template_payload.get("pages", [])
    template_sections = template_payload.get("sections", [])
    fill_targets = template_payload.get("fillTargets", [])
    if not isinstance(pages, list) or not pages:
        raise GameLessonStageBlocked("interactive_bundle requires template pages")
    if not isinstance(template_sections, list) or not template_sections:
        raise GameLessonStageBlocked("interactive_bundle requires template sections")
    if not isinstance(fill_targets, list) or not fill_targets:
        raise GameLessonStageBlocked("interactive_bundle requires template fill targets")
    actions_by_section: dict[str, list[dict[str, Any]]] = {}
    for action in handwriting_payload.get("actions", []):
        if isinstance(action, dict):
            actions_by_section.setdefault(str(action.get("sectionId")), []).append(action)
    narration_by_section = {
        str(section.get("sectionId")): section
        for section in narration_payload.get("sections", [])
        if isinstance(section, dict)
    }
    sections = []
    for section in template_sections:
        if not isinstance(section, dict):
            continue
        section_id = str(section.get("id"))
        sections.append(
            {
                "sectionId": section_id,
                "title": section.get("title"),
                "regionId": section.get("regionId"),
                "clickTarget": section.get("clickTarget"),
                "narration": narration_by_section.get(section_id),
                "handwritingActions": actions_by_section.get(section_id, []),
                "completionMode": "section_click",
            }
        )
    if not sections:
        raise GameLessonStageBlocked("interactive_bundle produced no sections")
    return {
        "summary": (
            "Playable worksheet bundle for the browser. Sections can be clicked to "
            "play narration and reveal mapped handwriting actions."
        ),
        "bundleVersion": 1,
        "templateId": run.template_id,
        "selectedInstructorId": run.selected_instructor_id,
        "pages": pages,
        "fillTargets": fill_targets,
        "sections": sections,
        "completedSections": [],
    }


def _lesson_publish_payload(
    run: _StoredRun,
    template_payload: dict[str, Any],
    interactive_bundle: _StoredArtifact | None,
) -> dict[str, Any]:
    bundle_payload = interactive_bundle.payload if interactive_bundle else {}
    pages = bundle_payload.get("pages", [])
    sections = bundle_payload.get("sections", [])
    if not isinstance(pages, list) or not pages:
        raise GameLessonStageBlocked("lesson_publish requires a non-empty interactive bundle")
    if not isinstance(sections, list) or not sections:
        raise GameLessonStageBlocked("lesson_publish requires bundle sections")
    return {
        "summary": (
            "Canonical Lesson 1 publish marker. This points every learner at the "
            "approved interactive worksheet bundle without rerunning provider stages."
        ),
        "publishVersion": 1,
        "published": True,
        "templateId": run.template_id,
        "templateVersion": template_payload.get("templateVersion", 1),
        "selectedInstructorId": run.selected_instructor_id,
        "interactiveBundleArtifactId": interactive_bundle.id if interactive_bundle else None,
        "interactiveBundleVersion": interactive_bundle.version if interactive_bundle else None,
        "sectionCount": len(sections),
        "pageCount": len(pages),
        "studentReadyAt": _now(),
    }


def _section_narration(section_id: str, title: str, answers: list[str]) -> str:
    if section_id == "do_now":
        return (
            "Begin with the Do Now. Read each prompt carefully and type short answers "
            "into the boxes. Think about counting one layer first, then using the "
            "number of layers to find the total cubes."
        )
    if section_id == "vocabulary":
        return (
            "Volume means the amount of space inside a three-dimensional shape. "
            "Cubic units are the little cubes we use to measure that space. In real "
            "life, this is how we reason about boxes, storage bins, and packing space."
        )
    if section_id == "guided_practice":
        return (
            "For Guided Practice, use each row's length, width, and height fields to "
            "find volume. Type the final volume in cubic units, and check that the "
            "number makes sense for the size of the prism."
        )
    return (
        f"In {title}, give clear directions for the fixed worksheet boxes and keep the "
        "language short enough for a sixth grader."
    )


def _speech_ready_text(narration: str) -> str:
    sentences = [
        sentence.strip() for sentence in narration.replace("\n", " ").split(".") if sentence.strip()
    ]
    return '<break time="0.5s" /> '.join(f"{sentence}." for sentence in sentences)


def _estimated_speech_duration_seconds(speech_text: str) -> float:
    stripped_text = speech_text.replace('<break time="0.5s" />', " ")
    word_count = len([word for word in stripped_text.split() if word.strip()])
    break_count = speech_text.count('<break time="0.5s" />')
    return round(max(word_count / 2.65 + break_count * 0.5, 4.0), 2)


def _estimated_alignment(
    speech_text: str,
    offset_seconds: float,
    duration_seconds: float,
) -> dict[str, list[float]]:
    character_count = max(len(speech_text), 1)
    step = duration_seconds / character_count
    starts = [round(offset_seconds + index * step, 3) for index in range(character_count)]
    ends = [round(start + step, 3) for start in starts]
    return {
        "characters": list(speech_text),
        "characterStartTimesSeconds": starts,
        "characterEndTimesSeconds": ends,
    }


def _target_index(section_targets: list[dict[str, Any]], target_id: str) -> int:
    for index, target in enumerate(section_targets):
        if str(target.get("id")) == target_id:
            return index
    return 0


def _questions_by_section(template_payload: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for question in template_payload.get("questions", []):
        if isinstance(question, dict) and "sectionId" in question:
            grouped.setdefault(str(question["sectionId"]), []).append(question)
    return grouped


def _fill_targets_by_section(template_payload: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for target in template_payload.get("fillTargets", []):
        if isinstance(target, dict) and "sectionId" in target:
            grouped.setdefault(str(target["sectionId"]), []).append(target)
    return grouped


def _artifact_to_response(artifact: _StoredArtifact) -> GameLessonArtifact:
    return GameLessonArtifact(
        id=artifact.id,
        run_id=artifact.run_id,
        stage=artifact.stage,
        version=artifact.version,
        status=artifact.status,
        is_current=artifact.is_current,
        payload=artifact.payload,
        storage_refs=artifact.storage_refs,
        error_message=artifact.error_message,
        stale_reason=artifact.stale_reason,
        config_metadata=artifact.config_metadata,
        created_at=artifact.created_at,
        updated_at=artifact.updated_at,
    )


def _approval_to_response(approval: _StoredApproval) -> GameLessonArtifactApproval:
    return GameLessonArtifactApproval(
        id=approval.id,
        artifact_id=approval.artifact_id,
        run_id=approval.run_id,
        artifact_version=approval.artifact_version,
        user_id=approval.user_id,
        decision=approval.decision,  # type: ignore[arg-type]
        notes=approval.notes,
        created_at=approval.created_at,
    )


def _run_from_row(row: dict[str, Any]) -> _StoredRun:
    return _StoredRun(
        id=row["id"],
        user_id=row["user_id"],
        template_id=row["template_id"],
        selected_instructor_id=row.get("selected_instructor_id"),
        status=row["status"],
        metadata=row.get("metadata") or {},
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _artifact_from_row(row: dict[str, Any]) -> _StoredArtifact:
    return _StoredArtifact(
        id=row["id"],
        run_id=row["run_id"],
        stage=row["stage"],
        version=row["version"],
        status=row["status"],
        is_current=row["is_current"],
        payload=row.get("payload") or {},
        storage_refs=row.get("storage_refs") or [],
        error_message=row.get("error_message"),
        stale_reason=row.get("stale_reason"),
        config_metadata=row.get("config_metadata") or {},
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _approval_from_row(row: dict[str, Any]) -> _StoredApproval:
    return _StoredApproval(
        id=row["id"],
        artifact_id=row["artifact_id"],
        run_id=row["run_id"],
        artifact_version=row["artifact_version"],
        user_id=row["user_id"],
        decision=row["decision"],
        notes=row.get("notes"),
        created_at=row["created_at"],
    )


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _raise_for_storage_error(response: httpx.Response) -> None:
    if response.is_success:
        return
    body = response.text.strip()
    if len(body) > 500:
        body = f"{body[:500]}..."
    detail = f": {body}" if body else ""
    raise GameLessonStorageError(
        f"Game lesson storage request failed: {response.status_code}{detail}"
    )
