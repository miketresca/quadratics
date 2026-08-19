import pytest
from pydantic import ValidationError

from app.schemas.animation import AnimationPlan


def plan_payload(**overrides):
    payload = {
        "lessonArtifactId": "lesson-artifact-1",
        "narrationArtifactId": "narration-artifact-1",
        "cues": [
            {
                "id": "cue_1",
                "lessonStepId": "factor",
                "mathLineId": "standard_form",
                "trigger": {
                    "type": "narration_text",
                    "scriptSegmentId": "script_factor",
                    "text": "Start with x squared",
                },
                "visual": {
                    "action": "write_math",
                    "target": {
                        "lessonStepId": "factor",
                        "mathLineId": "standard_form",
                    },
                },
                "sync": {"mode": "with_narration"},
            }
        ],
    }
    payload.update(overrides)
    return payload


def test_animation_plan_accepts_supported_primitives():
    plan = AnimationPlan.model_validate(plan_payload())

    assert plan.cues[0].visual.action == "write_math"


def test_animation_plan_rejects_invalid_primitive():
    payload = plan_payload()
    payload["cues"][0]["visual"]["action"] = "spin_equation"

    with pytest.raises(ValidationError):
        AnimationPlan.model_validate(payload)


def test_animation_plan_rejects_invalid_sync_mode():
    payload = plan_payload()
    payload["cues"][0]["sync"]["mode"] = "whenever"

    with pytest.raises(ValidationError):
        AnimationPlan.model_validate(payload)


def test_write_math_requires_math_line_target():
    payload = plan_payload()
    payload["cues"][0]["visual"]["target"] = {"lessonStepId": "factor"}

    with pytest.raises(ValidationError, match="math_line"):
        AnimationPlan.model_validate(payload)
