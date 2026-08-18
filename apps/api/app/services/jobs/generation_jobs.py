from __future__ import annotations

from dataclasses import dataclass
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
