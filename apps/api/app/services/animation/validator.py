from __future__ import annotations

from app.schemas.animation import AnimationPlan
from app.schemas.lesson import LessonResponse
from app.schemas.script import LessonScript


class AnimationPlanValidationError(ValueError):
    pass


def validate_animation_plan(
    plan: AnimationPlan,
    *,
    lesson: LessonResponse,
    script: LessonScript,
) -> None:
    step_ids = {step.id for step in lesson.steps}
    line_to_step = {
        line.id: step.id
        for step in lesson.steps
        for line in step.math_lines
    }
    script_segments = {segment.id: segment for segment in script.segments}

    for cue in plan.cues:
        if cue.lesson_step_id not in step_ids:
            raise AnimationPlanValidationError(f"unknown lesson step id '{cue.lesson_step_id}'")
        if cue.math_line_id and cue.math_line_id not in line_to_step:
            raise AnimationPlanValidationError(f"unknown math line id '{cue.math_line_id}'")
        if cue.math_line_id and line_to_step[cue.math_line_id] != cue.lesson_step_id:
            raise AnimationPlanValidationError(
                f"math line '{cue.math_line_id}' does not belong to step '{cue.lesson_step_id}'"
            )
        segment = script_segments.get(cue.trigger.script_segment_id)
        if segment is None:
            raise AnimationPlanValidationError(
                f"unknown script segment id '{cue.trigger.script_segment_id}'"
            )
        if segment.step_id != cue.lesson_step_id:
            raise AnimationPlanValidationError(
                f"script segment '{segment.id}' does not belong to step '{cue.lesson_step_id}'"
            )
        target = cue.visual.target
        if target is not None:
            if target.lesson_step_id and target.lesson_step_id not in step_ids:
                raise AnimationPlanValidationError(
                    f"unknown target lesson step id '{target.lesson_step_id}'"
                )
            if target.math_line_id and target.math_line_id not in line_to_step:
                raise AnimationPlanValidationError(
                    f"unknown target math line id '{target.math_line_id}'"
                )
            if (
                target.math_line_id
                and target.lesson_step_id
                and line_to_step[target.math_line_id] != target.lesson_step_id
            ):
                raise AnimationPlanValidationError(
                    f"target math line '{target.math_line_id}' does not belong to "
                    f"step '{target.lesson_step_id}'"
                )
