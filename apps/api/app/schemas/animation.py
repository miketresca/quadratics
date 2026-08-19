from typing import Any, Literal

from pydantic import Field, model_validator

from app.schemas.common import ApiModel

AnimationPrimitive = Literal[
    "write_math",
    "write_text",
    "highlight",
    "emphasize",
    "circle",
    "underline",
    "box",
    "arrow",
    "erase_annotation",
    "replace_fragment",
    "pause",
    "point",
    "dim",
    "restore",
]

AnimationSyncMode = Literal[
    "before_narration",
    "with_narration",
    "after_narration",
    "through_narration",
]


class AnimationTrigger(ApiModel):
    type: Literal["narration_text"]
    script_segment_id: str = Field(min_length=1)
    text: str = Field(min_length=1)
    occurrence: int | None = Field(default=None, ge=1)


class AnimationTarget(ApiModel):
    lesson_step_id: str | None = Field(default=None, min_length=1)
    math_line_id: str | None = Field(default=None, min_length=1)
    fragment: str | None = Field(default=None, min_length=1)

    @model_validator(mode="after")
    def target_has_reference_for_visual_actions(self) -> "AnimationTarget":
        if self.lesson_step_id is None and self.math_line_id is None:
            raise ValueError("animation target requires lesson_step_id or math_line_id")
        return self


class AnimationVisual(ApiModel):
    action: AnimationPrimitive
    target: AnimationTarget | None = None
    text: str | None = Field(default=None, min_length=1)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def visual_payload_matches_action(self) -> "AnimationVisual":
        if self.action in {"write_math", "highlight", "emphasize", "circle", "underline", "box"}:
            if self.target is None or self.target.math_line_id is None:
                raise ValueError(f"{self.action} requires a math_line target")
        if self.action == "write_text" and not self.text:
            raise ValueError("write_text requires text")
        return self


class AnimationSync(ApiModel):
    mode: AnimationSyncMode


class AnimationCue(ApiModel):
    id: str = Field(min_length=1)
    lesson_step_id: str = Field(min_length=1)
    math_line_id: str | None = Field(default=None, min_length=1)
    trigger: AnimationTrigger
    visual: AnimationVisual
    sync: AnimationSync
    metadata: dict[str, Any] = Field(default_factory=dict)


class BlackboardLayout(ApiModel):
    theme: Literal["chalkboard"] = "chalkboard"
    vertical_flow: bool = True


class AnimationPlan(ApiModel):
    version: Literal["animation-plan/v1"] = "animation-plan/v1"
    lesson_artifact_id: str = Field(min_length=1)
    narration_artifact_id: str = Field(min_length=1)
    duration_seconds: float | None = Field(default=None, ge=0)
    layout: BlackboardLayout = Field(default_factory=BlackboardLayout)
    cues: list[AnimationCue] = Field(min_length=1)
    sound_cues: list[dict[str, Any]] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
