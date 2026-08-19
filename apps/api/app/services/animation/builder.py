from pathlib import Path

from app.schemas.animation import AnimationPlan
from app.schemas.lesson import LessonResponse
from app.schemas.narration import LessonNarration
from app.schemas.script import LessonScript
from app.services.animation.base import AnimationPlanningRequest, AnimationPlanProvider
from app.services.animation.validator import validate_animation_plan

PROMPT_PATH = Path(__file__).parent / "prompts" / "blackboard_animation_plan.md"

SUPPORTED_ANIMATION_PRIMITIVES = [
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


async def build_animation_plan(
    *,
    lesson: LessonResponse,
    script: LessonScript,
    narration: LessonNarration,
    lesson_artifact_id: str,
    narration_artifact_id: str,
    provider: AnimationPlanProvider,
) -> AnimationPlan:
    request = AnimationPlanningRequest(
        lesson=lesson.model_dump(mode="json", by_alias=True),
        script=script.model_dump(mode="json", by_alias=True),
        narration=_narration_context(narration),
        supported_primitives=SUPPORTED_ANIMATION_PRIMITIVES,
        prompt=PROMPT_PATH.read_text(encoding="utf-8"),
    )
    plan = await provider.generate_animation_plan(request)
    plan.lesson_artifact_id = lesson_artifact_id
    plan.narration_artifact_id = narration_artifact_id
    validate_animation_plan(plan, lesson=lesson, script=script)
    return plan


def _narration_context(narration: LessonNarration) -> dict[str, object]:
    return {
        "speechText": narration.speech_text,
        "durationSeconds": narration.duration_seconds,
        "segments": [
            {
                "scriptSegmentId": segment.script_segment_id,
                "stepId": segment.step_id,
                "speechText": segment.speech_text,
                "durationSeconds": segment.duration_seconds,
            }
            for segment in narration.segments
        ],
    }
