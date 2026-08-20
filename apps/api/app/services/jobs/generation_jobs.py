from __future__ import annotations

from dataclasses import dataclass
from threading import Lock
from uuid import uuid4

import httpx

from app.core.config import Settings


@dataclass(frozen=True)
class GenerationJobRecord:
    id: str
    user_id: str
    equation_input: str
    normalized_equation: str | None
    equation_hash: str | None
    instructor_id: str | None
    status: str
    credits_used: int


def new_solve_job(
    *,
    user_id: str,
    equation_input: str,
    normalized_equation: str | None,
    equation_hash: str | None,
    instructor_id: str | None,
) -> GenerationJobRecord:
    return GenerationJobRecord(
        id=str(uuid4()),
        user_id=user_id,
        equation_input=equation_input,
        normalized_equation=normalized_equation,
        equation_hash=equation_hash,
        instructor_id=instructor_id,
        status="completed",
        credits_used=0,
    )


class InMemoryGenerationJobRepository:
    def __init__(self) -> None:
        self._jobs: dict[str, GenerationJobRecord] = {}
        self._lock = Lock()

    def create_solve_job(
        self,
        *,
        user_id: str,
        equation_input: str,
        normalized_equation: str | None,
        equation_hash: str | None,
        instructor_id: str | None,
    ) -> GenerationJobRecord:
        with self._lock:
            job = new_solve_job(
                user_id=user_id,
                equation_input=equation_input,
                normalized_equation=normalized_equation,
                equation_hash=equation_hash,
                instructor_id=instructor_id,
            )
            self._jobs[job.id] = job
            return job

    def get_for_user(self, *, generation_job_id: str, user_id: str) -> GenerationJobRecord | None:
        with self._lock:
            job = self._jobs.get(generation_job_id)
            if job is None or job.user_id != user_id:
                return None
            return job

    def latest_for_user_equation(
        self,
        *,
        user_id: str,
        normalized_equation: str,
        instructor_id: str | None,
    ) -> GenerationJobRecord | None:
        with self._lock:
            matches = [
                job
                for job in self._jobs.values()
                if job.user_id == user_id
                and job.normalized_equation == normalized_equation
                and job.instructor_id == instructor_id
            ]
            return matches[-1] if matches else None

    def latest_for_user(self, *, user_id: str) -> GenerationJobRecord | None:
        with self._lock:
            matches = [job for job in self._jobs.values() if job.user_id == user_id]
            return matches[-1] if matches else None


class SupabaseGenerationJobRepository:
    def __init__(self, settings: Settings) -> None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise GenerationJobStorageError("Supabase generation job storage is not configured")
        self._base_url = settings.supabase_url.rstrip("/")
        self._headers = {
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": "application/json",
        }

    def create_solve_job(
        self,
        *,
        user_id: str,
        equation_input: str,
        normalized_equation: str | None,
        equation_hash: str | None,
        instructor_id: str | None,
    ) -> GenerationJobRecord:
        payload = {
            "user_id": user_id,
            "equation_input": equation_input,
            "normalized_equation": normalized_equation,
            "equation_hash": equation_hash,
            "instructor_id": instructor_id,
            "status": "completed",
            "credits_used": 0,
        }
        with httpx.Client() as client:
            response = client.post(
                f"{self._base_url}/rest/v1/generation_jobs",
                headers={**self._headers, "Prefer": "return=representation"},
                params={"select": _JOB_COLUMNS},
                json=payload,
            )
        _raise_for_job_storage_error(response)
        rows = response.json()
        if not rows:
            raise GenerationJobStorageError("Generation job was not returned after create")
        return _job_from_row(rows[0])

    def get_for_user(self, *, generation_job_id: str, user_id: str) -> GenerationJobRecord | None:
        with httpx.Client() as client:
            response = client.get(
                f"{self._base_url}/rest/v1/generation_jobs",
                headers=self._headers,
                params={
                    "id": f"eq.{generation_job_id}",
                    "user_id": f"eq.{user_id}",
                    "select": _JOB_COLUMNS,
                    "limit": "1",
                },
            )
        _raise_for_job_storage_error(response)
        rows = response.json()
        return _job_from_row(rows[0]) if rows else None

    def latest_for_user_equation(
        self,
        *,
        user_id: str,
        normalized_equation: str,
        instructor_id: str | None,
    ) -> GenerationJobRecord | None:
        params = {
            "user_id": f"eq.{user_id}",
            "normalized_equation": f"eq.{normalized_equation}",
            "select": _JOB_COLUMNS,
            "order": "created_at.desc",
            "limit": "1",
        }
        if instructor_id is None:
            params["instructor_id"] = "is.null"
        else:
            params["instructor_id"] = f"eq.{instructor_id}"
        with httpx.Client() as client:
            response = client.get(
                f"{self._base_url}/rest/v1/generation_jobs",
                headers=self._headers,
                params=params,
            )
        _raise_for_job_storage_error(response)
        rows = response.json()
        return _job_from_row(rows[0]) if rows else None

    def latest_for_user(self, *, user_id: str) -> GenerationJobRecord | None:
        with httpx.Client() as client:
            response = client.get(
                f"{self._base_url}/rest/v1/generation_jobs",
                headers=self._headers,
                params={
                    "user_id": f"eq.{user_id}",
                    "select": _JOB_COLUMNS,
                    "order": "created_at.desc",
                    "limit": "1",
                },
            )
        _raise_for_job_storage_error(response)
        rows = response.json()
        return _job_from_row(rows[0]) if rows else None


class GenerationJobStorageError(RuntimeError):
    pass


_JOB_COLUMNS = (
    "id,user_id,equation_input,normalized_equation,equation_hash,"
    "instructor_id,status,credits_used"
)


def _job_from_row(row: dict[str, object]) -> GenerationJobRecord:
    return GenerationJobRecord(
        id=str(row["id"]),
        user_id=str(row["user_id"]),
        equation_input=str(row["equation_input"]),
        normalized_equation=_optional_str(row.get("normalized_equation")),
        equation_hash=_optional_str(row.get("equation_hash")),
        instructor_id=_optional_str(row.get("instructor_id")),
        status=str(row["status"]),
        credits_used=int(row.get("credits_used") or 0),
    )


def _optional_str(value: object) -> str | None:
    return str(value) if value is not None else None


def _raise_for_job_storage_error(response: httpx.Response) -> None:
    if response.is_success:
        return
    raise GenerationJobStorageError(
        f"Generation job storage request failed: {response.status_code}"
    )
