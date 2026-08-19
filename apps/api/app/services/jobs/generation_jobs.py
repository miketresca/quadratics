from __future__ import annotations

from dataclasses import dataclass
from threading import Lock
from uuid import uuid4


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
