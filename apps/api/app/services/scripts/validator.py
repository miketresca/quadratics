from app.schemas.lesson import LessonResponse
from app.schemas.script import LessonScript


class ScriptValidationError(ValueError):
    pass


def validate_script_for_lesson(
    script: LessonScript,
    lesson: LessonResponse,
    word_budget: int,
) -> None:
    if script.status != "completed":
        return

    if lesson.method != "factoring":
        raise ScriptValidationError("completed scripts are only supported for factoring lessons")
    if script.method != lesson.method:
        raise ScriptValidationError("script method must match the deterministic lesson method")

    steps_by_id = {step.id: step for step in lesson.steps}
    if [segment.step_id for segment in script.segments] != [step.id for step in lesson.steps]:
        raise ScriptValidationError("script segment order must match lesson step order")

    total_word_count = 0
    total_estimated_seconds = 0.0
    for segment in script.segments:
        step = steps_by_id.get(segment.step_id)
        if step is None:
            raise ScriptValidationError(f"unknown script step id: {segment.step_id}")

        line_ids = {line.id for line in step.math_lines}
        unknown_line_ids = [line_id for line_id in segment.math_line_ids if line_id not in line_ids]
        if unknown_line_ids:
            raise ScriptValidationError(
                f"unknown math line ids for step {segment.step_id}: {', '.join(unknown_line_ids)}"
            )

        actual_word_count = len(segment.narration.split())
        if segment.word_count != actual_word_count:
            segment.word_count = actual_word_count
        total_word_count += segment.word_count
        total_estimated_seconds += segment.estimated_seconds

    if total_word_count > word_budget:
        raise ScriptValidationError(
            f"script word count {total_word_count} exceeds budget {word_budget}"
        )

    script.total_word_count = total_word_count
    script.total_estimated_seconds = total_estimated_seconds
