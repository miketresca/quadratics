from typing import Literal
from uuid import UUID

from app.schemas.artifact import GenerationArtifact, GenerationArtifactDependency
from app.schemas.common import ApiModel
from app.schemas.lesson import LessonResponse

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


class GenerationSnapshot(ApiModel):
    job: GenerationJob
    lesson: LessonResponse
    artifacts: list[GenerationArtifact]
    dependencies: list[GenerationArtifactDependency] = []
