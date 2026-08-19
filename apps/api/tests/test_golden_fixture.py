import json
from pathlib import Path

from app.schemas.lesson import LessonResponse
from app.schemas.narration import LessonNarration
from app.schemas.script import LessonScript

FIXTURE_ROOT = Path(__file__).parents[3] / "fixtures" / "golden" / "x2-plus-5x-plus-6"


def read_fixture(name: str) -> dict:
    return json.loads((FIXTURE_ROOT / name).read_text(encoding="utf-8"))


def test_golden_fixture_validates_against_api_models():
    lesson = LessonResponse.model_validate(read_fixture("lesson.json"))
    script = LessonScript.model_validate(read_fixture("script.json"))
    narration = LessonNarration.model_validate(read_fixture("narration.json"))

    assert lesson.normalized_equation == "x**2 + 5*x + 6 = 0"
    assert script.status == "completed"
    assert narration.status == "completed"
    assert narration.provider == "development"


def test_golden_fixture_references_existing_lesson_objects():
    lesson = LessonResponse.model_validate(read_fixture("lesson.json"))
    script = LessonScript.model_validate(read_fixture("script.json"))
    narration = LessonNarration.model_validate(read_fixture("narration.json"))

    step_ids = {step.id for step in lesson.steps}
    math_line_ids = {line.id for step in lesson.steps for line in step.math_lines}
    script_segment_ids = {segment.id for segment in script.segments}

    assert {segment.step_id for segment in script.segments} <= step_ids
    assert {
        math_line_id for segment in script.segments for math_line_id in segment.math_line_ids
    } <= math_line_ids
    assert {segment.script_segment_id for segment in narration.segments} <= script_segment_ids
