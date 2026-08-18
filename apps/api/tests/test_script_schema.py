import pytest
from pydantic import ValidationError

from app.schemas.script import LessonScript, ScriptSegment


def test_lesson_script_requires_segments_when_completed():
    with pytest.raises(ValidationError):
        LessonScript(status="completed", method="factoring")


def test_lesson_script_rejects_empty_narration():
    with pytest.raises(ValidationError):
        ScriptSegment(
            id="script_factor",
            step_id="factor",
            title="Factor the quadratic",
            narration="",
            math_line_ids=["standard_form"],
            estimated_seconds=10,
            word_count=20,
        )


def test_lesson_script_rejects_empty_math_line_reference():
    with pytest.raises(ValidationError):
        ScriptSegment(
            id="script_factor",
            step_id="factor",
            title="Factor the quadratic",
            narration="Factor the expression.",
            math_line_ids=[],
            estimated_seconds=10,
            word_count=20,
        )


def test_lesson_script_rejects_negative_duration():
    with pytest.raises(ValidationError):
        ScriptSegment(
            id="script_factor",
            step_id="factor",
            title="Factor the quadratic",
            narration="Factor the expression.",
            math_line_ids=["standard_form"],
            estimated_seconds=-1,
            word_count=20,
        )
