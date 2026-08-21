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

TEMPLATE_ID = "volume-cubes-lesson-1"
STAGE_ORDER: tuple[str, ...] = (
    "template",
    "section_script",
    "speech_markup",
    "narration",
    "handwriting",
    "interactive_bundle",
)
STAGE_DEPENDENCIES: dict[str, tuple[str, ...]] = {
    "template": (),
    "section_script": ("template",),
    "speech_markup": ("section_script",),
    "narration": ("speech_markup",),
    "handwriting": ("narration",),
    "interactive_bundle": ("handwriting",),
}
PAID_OR_PROVIDER_STAGES = {"section_script", "speech_markup", "narration"}
_TEMPLATE_COLUMNS = "id,title,version,payload"
_RUN_COLUMNS = (
    "id,user_id,template_id,selected_instructor_id,status,metadata,created_at,updated_at"
)
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
            self._templates[TEMPLATE_ID] = GameWorksheetTemplate(
                id=TEMPLATE_ID,
                title="Volume With Whole-Number Cubes",
                version=1,
                payload={
                    "source": "misc/task/task_lesson.pdf",
                    "sections": ["do_now", "vocabulary", "guided_practice"],
                },
            )

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
            if stage in PAID_OR_PROVIDER_STAGES:
                raise GameLessonStageBlocked(
                    f"{stage} is not implemented yet; approval-gated provider stages will run in the next pipeline slice."
                )
        current = self._current_artifact(run.id, stage)
        if current and current.status in ("completed", "approved") and not request.force:
            return self._snapshot(run)
        self._create_artifact(run, stage)
        self._mark_descendants_stale(run.id, stage)
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
            status="completed",
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
        if stage == "template":
            return {
                "templateId": run.template_id,
                "templateVersion": self._template(run.template_id).version,
                "source": self._template(run.template_id).payload["source"],
                "sections": self._template(run.template_id).payload["sections"],
            }
        return {"stage": stage}

    def _assert_upstream_ready(self, run_id: str, stage: str) -> None:
        for upstream_stage in STAGE_DEPENDENCIES[stage]:
            upstream = self._current_artifact(run_id, upstream_stage)
            if upstream is None or upstream.status not in ("completed", "approved"):
                raise GameLessonStageBlocked(f"{stage} requires completed {upstream_stage}")

    def _mark_descendants_stale(self, run_id: str, stage: str) -> None:
        stage_index = STAGE_ORDER.index(stage)
        descendants = set(STAGE_ORDER[stage_index + 1 :])
        for artifact in self._artifacts.values():
            if artifact.run_id != run_id or artifact.stage not in descendants or not artifact.is_current:
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
            if stage in PAID_OR_PROVIDER_STAGES:
                raise GameLessonStageBlocked(
                    f"{stage} is not implemented yet; approval-gated provider stages will run in the next pipeline slice."
                )
        current = await self._current_artifact(run.id, stage)
        if current and current.status in ("completed", "approved") and not request.force:
            return await self._snapshot(run)
        await self._create_artifact(run, stage)
        await self._mark_descendants_stale(run.id, stage)
        await self._touch_run(run.id)
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
                    "status": "completed",
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
        if stage != "template":
            return {"stage": stage}
        template = await self._get_template(run.template_id)
        return {
            "templateId": run.template_id,
            "templateVersion": template.version,
            "source": template.payload["source"],
            "sections": template.payload["sections"],
        }

    async def _assert_upstream_ready(self, run_id: str, stage: str) -> None:  # type: ignore[override]
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

    async def _touch_run(self, run_id: str) -> None:
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{self._base_url}/rest/v1/game_worksheet_runs",
                headers=self._headers,
                params={"id": f"eq.{run_id}"},
                json={"updated_at": _now()},
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
