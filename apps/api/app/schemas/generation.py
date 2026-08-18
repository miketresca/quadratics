from typing import Literal
from uuid import UUID

from app.schemas.common import ApiModel

GenerationStatus = Literal["pending", "processing", "completed", "failed"]


class GenerationJob(ApiModel):
    id: UUID
    user_id: UUID
    equation_input: str
    normalized_equation: str | None = None
    equation_hash: str | None = None
    instructor_id: str | None = None
    status: GenerationStatus
    credits_used: int = 0
