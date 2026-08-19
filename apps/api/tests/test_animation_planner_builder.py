import json
from pathlib import Path

import pytest

from app.schemas.animation import AnimationPlan
from app.schemas.lesson import LessonResponse
from app.schemas.narration import LessonNarration
from app.schemas.script import LessonScript
from app.services.animation.base import AnimationPlanningRequest, AnimationPlanProvider
from app.services.animation.builder import build_animation_plan
from app.services.animation.validator import AnimationPlanValidationError

FIXTURE_ROOT = Path(__file__).parents[3] / "fixtures" / "golden" / "x2-plus-5x-plus-6"
PLAN_FIXTURE = (
    Path(__file__).parents[3]
    / "packages"
    / "types"
    / "tests"
    / "fixtures"
    / "animation_plan.json"
)


class RecordingAnimationPlanProvider(AnimationPlanProvider):
    def __init__(self, plan: AnimationPlan) -> None:
        self.plan = plan
        self.requests: list[AnimationPlanningRequest] = []

    async def generate_animation_plan(self, request: AnimationPlanningRequest) -> AnimationPlan:
        self.requests.append(request)
        return self.plan


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.mark.asyncio
async def test_animation_planner_builder_passes_context_and_validates_plan():
    lesson = LessonResponse.model_validate(load_json(FIXTURE_ROOT / "lesson.json"))
    script = LessonScript.model_validate(load_json(FIXTURE_ROOT / "script.json"))
    narration = LessonNarration.model_validate(load_json(FIXTURE_ROOT / "narration.json"))
    provider = RecordingAnimationPlanProvider(AnimationPlan.model_validate(load_json(PLAN_FIXTURE)))

    plan = await build_animation_plan(
        lesson=lesson,
        script=script,
        narration=narration,
        lesson_artifact_id="lesson-artifact-1",
        narration_artifact_id="narration-artifact-1",
        provider=provider,
    )

    assert plan.lesson_artifact_id == "lesson-artifact-1"
    assert plan.narration_artifact_id == "narration-artifact-1"
    assert provider.requests[0].lesson["steps"][0]["id"] == "factor"
    assert provider.requests[0].narration["segments"][0]["scriptSegmentId"] == "script_factor"


@pytest.mark.asyncio
async def test_animation_planner_builder_rejects_hallucinated_targets():
    lesson = LessonResponse.model_validate(load_json(FIXTURE_ROOT / "lesson.json"))
    script = LessonScript.model_validate(load_json(FIXTURE_ROOT / "script.json"))
    narration = LessonNarration.model_validate(load_json(FIXTURE_ROOT / "narration.json"))
    payload = load_json(PLAN_FIXTURE)
    payload["cues"][0]["mathLineId"] = "hallucinated"
    provider = RecordingAnimationPlanProvider(AnimationPlan.model_validate(payload))

    with pytest.raises(AnimationPlanValidationError, match="unknown math line"):
        await build_animation_plan(
            lesson=lesson,
            script=script,
            narration=narration,
            lesson_artifact_id="lesson-artifact-1",
            narration_artifact_id="narration-artifact-1",
            provider=provider,
        )


@pytest.mark.asyncio
async def test_animation_planner_builder_allows_emphasis_on_prior_step_math_line():
    lesson = LessonResponse.model_validate(load_json(FIXTURE_ROOT / "lesson.json"))
    script = LessonScript.model_validate(load_json(FIXTURE_ROOT / "script.json"))
    narration = LessonNarration.model_validate(load_json(FIXTURE_ROOT / "narration.json"))
    payload = load_json(PLAN_FIXTURE)
    payload["cues"][0] = {
        "id": "cue_reference_factored_form",
        "lessonStepId": "solve_factors",
        "mathLineId": "factored_form",
        "trigger": {
            "type": "narration_text",
            "scriptSegmentId": "script_solve_factors",
            "text": "Now set each factor equal to zero",
        },
        "visual": {
            "action": "underline",
            "target": {
                "lessonStepId": "solve_factors",
                "mathLineId": "factored_form",
            },
        },
        "sync": {"mode": "with_narration"},
    }
    provider = RecordingAnimationPlanProvider(AnimationPlan.model_validate(payload))

    plan = await build_animation_plan(
        lesson=lesson,
        script=script,
        narration=narration,
        lesson_artifact_id="lesson-artifact-1",
        narration_artifact_id="narration-artifact-1",
        provider=provider,
    )

    assert plan.cues[0].lesson_step_id == "solve_factors"
    assert plan.cues[0].math_line_id == "factored_form"
    assert plan.cues[0].visual.target
    assert plan.cues[0].visual.target.lesson_step_id == "factor"
