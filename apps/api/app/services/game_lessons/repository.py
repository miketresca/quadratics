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
    GameLessonArtifactStatus,
    GameLessonRunStageRequest,
    GameLessonStage,
    GameWorksheetRunCreateRequest,
    GameWorksheetRunSnapshot,
    GameWorksheetTemplate,
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
        self._create_artifact(run, stage)
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

    def _create_artifact(self, run: _StoredRun, stage: str) -> _StoredArtifact:
        now = _now()
        current = self._current_artifact(run.id, stage)
        next_version = (current.version + 1) if current else 1
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
            payload=self._payload_for_stage(run, stage),
            storage_refs=[],
            error_message=None,
            stale_reason=None,
            config_metadata={"provider": "deterministic", "source": "game_lesson_repository"},
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
        return template

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
    def __init__(self, settings: Settings) -> None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise GameLessonStorageError("Supabase game lesson storage is not configured")
        self._base_url = settings.supabase_url.rstrip("/")
        self._headers = {
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": "application/json",
        }

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
        await self._create_artifact(run, stage)
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
        return GameWorksheetTemplate.model_validate(rows[0])

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
        next_version = (current.version + 1) if current else 1
        payload = await self._payload_for_stage_from_storage(run, stage)
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
                    "payload": payload,
                    "storage_refs": [],
                    "config_metadata": {
                        "provider": "deterministic",
                        "source": "game_lesson_repository",
                    },
                },
            )
        _raise_for_storage_error(create_response)
        rows = create_response.json()
        if not rows:
            raise GameLessonStorageError("Game lesson artifact was not returned after create")
        return _artifact_from_row(rows[0])

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
    narration_sections = {
        str(section.get("sectionId")): section
        for section in narration_payload.get("sections", [])
        if isinstance(section, dict)
    }
    actions = []
    for target in template_payload.get("fillTargets", []):
        if not isinstance(target, dict):
            continue
        section_id = str(target.get("sectionId"))
        section_timing = narration_sections.get(section_id, {})
        section_start = float(section_timing.get("startSeconds", 0))
        section_duration = float(section_timing.get("durationSeconds", 8))
        section_targets = [
            candidate
            for candidate in template_payload.get("fillTargets", [])
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
    for section in template_payload.get("sections", []):
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
    return {
        "summary": (
            "Playable worksheet bundle for the browser. Sections can be clicked to "
            "play narration and reveal mapped handwriting actions."
        ),
        "bundleVersion": 1,
        "templateId": run.template_id,
        "selectedInstructorId": run.selected_instructor_id,
        "pages": template_payload.get("pages", []),
        "fillTargets": template_payload.get("fillTargets", []),
        "sections": sections,
        "completedSections": [],
    }


def _lesson_publish_payload(
    run: _StoredRun,
    template_payload: dict[str, Any],
    interactive_bundle: _StoredArtifact | None,
) -> dict[str, Any]:
    bundle_payload = interactive_bundle.payload if interactive_bundle else {}
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
        "sectionCount": len(bundle_payload.get("sections", []))
        if isinstance(bundle_payload.get("sections"), list)
        else 0,
        "pageCount": len(bundle_payload.get("pages", []))
        if isinstance(bundle_payload.get("pages"), list)
        else 0,
        "studentReadyAt": _now(),
    }


def _section_narration(section_id: str, title: str, answers: list[str]) -> str:
    if section_id == "do_now":
        return (
            "Start with the Do Now. We are not using a formula yet. We are counting "
            "cubes in an organized way: "
            f"{' '.join(answers)} This helps us see volume before naming the rule."
        )
    if section_id == "vocabulary":
        return (
            "Now connect the picture to vocabulary. "
            f"{' '.join(answers)} The important idea is that volume counts how many "
            "same-size cubes fit inside the shape."
        )
    if section_id == "guided_practice":
        return (
            "For guided practice, use length times width times height on each row. "
            f"{' '.join(answers)} Each answer is written in cubic units because we "
            "are counting unit cubes."
        )
    return f"In {title}, explain the worksheet answers clearly: {' '.join(answers)}"


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
    raise GameLessonStorageError(f"Game lesson storage request failed: {response.status_code}")
