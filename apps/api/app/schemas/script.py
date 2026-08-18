from typing import Any, Literal

from pydantic import Field, field_validator, model_validator

from app.schemas.common import ApiModel
from app.schemas.lesson import LessonResponse, SolutionMethod

ScriptStatus = Literal["completed", "unsupported", "failed"]
OutputMode = Literal["video_audio", "audio"]


class ScriptSegment(ApiModel):
    id: str = Field(min_length=1)
    step_id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    narration: str = Field(min_length=1)
    math_line_ids: list[str] = Field(min_length=1)
    estimated_seconds: float = Field(ge=0)
    word_count: int = Field(ge=0)
    delivery_notes: list[str] = Field(default_factory=list)

    @field_validator("math_line_ids")
    @classmethod
    def math_line_ids_must_be_non_empty(cls, value: list[str]) -> list[str]:
        if any(not item for item in value):
            raise ValueError("math_line_ids cannot contain empty values")
        return value


class LessonScript(ApiModel):
    status: ScriptStatus
    method: SolutionMethod | None = None
    total_estimated_seconds: float = Field(default=0, ge=0)
    total_word_count: int = Field(default=0, ge=0)
    segments: list[ScriptSegment] = Field(default_factory=list)
    unsupported_reason: str | None = None
    provider_metadata: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def completed_scripts_need_segments(self) -> "LessonScript":
        if self.status == "completed" and not self.segments:
            raise ValueError("completed scripts must include at least one segment")
        if self.status != "completed" and self.segments:
            raise ValueError("only completed scripts may include segments")
        return self


class ScriptEquationRequest(ApiModel):
    equation: str
    instructor_id: str | None = None
    output_mode: OutputMode = "video_audio"


class ScriptEquationResponse(ApiModel):
    lesson: LessonResponse
    script: LessonScript
