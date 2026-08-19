import json
from pathlib import Path

import pytest

from app.schemas.animation import AnimationPlan
from app.schemas.lesson import LessonResponse
from app.schemas.script import LessonScript
from app.services.animation import AnimationPlanValidationError, validate_animation_plan

FIXTURE_ROOT = Path(__file__).parents[3] / "fixtures" / "golden" / "x2-plus-5x-plus-6"
PLAN_FIXTURE = (
    Path(__file__).parents[3]
    / "packages"
    / "types"
    / "tests"
    / "fixtures"
    / "animation_plan.json"
)


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def test_animation_plan_validator_accepts_known_references():
    lesson = LessonResponse.model_validate(load_json(FIXTURE_ROOT / "lesson.json"))
    script = LessonScript.model_validate(load_json(FIXTURE_ROOT / "script.json"))
    plan = AnimationPlan.model_validate(load_json(PLAN_FIXTURE))

    validate_animation_plan(plan, lesson=lesson, script=script)


def test_animation_plan_validator_rejects_unknown_math_line():
    lesson = LessonResponse.model_validate(load_json(FIXTURE_ROOT / "lesson.json"))
    script = LessonScript.model_validate(load_json(FIXTURE_ROOT / "script.json"))
    payload = load_json(PLAN_FIXTURE)
    payload["cues"][0]["mathLineId"] = "missing_line"
    plan = AnimationPlan.model_validate(payload)

    with pytest.raises(AnimationPlanValidationError, match="unknown math line"):
        validate_animation_plan(plan, lesson=lesson, script=script)


def test_animation_plan_validator_rejects_wrong_script_segment_step():
    lesson = LessonResponse.model_validate(load_json(FIXTURE_ROOT / "lesson.json"))
    script = LessonScript.model_validate(load_json(FIXTURE_ROOT / "script.json"))
    payload = load_json(PLAN_FIXTURE)
    payload["cues"][0]["trigger"]["scriptSegmentId"] = "script_final_answer"
    plan = AnimationPlan.model_validate(payload)

    with pytest.raises(AnimationPlanValidationError, match="does not belong"):
        validate_animation_plan(plan, lesson=lesson, script=script)
