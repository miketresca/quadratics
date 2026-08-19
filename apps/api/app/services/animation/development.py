from app.schemas.animation import AnimationPlan
from app.services.animation.base import AnimationPlanningRequest, AnimationPlanProvider


class DevelopmentAnimationPlanProvider(AnimationPlanProvider):
    async def generate_animation_plan(self, request: AnimationPlanningRequest) -> AnimationPlan:
        lesson_artifact_id = "development-lesson"
        narration_artifact_id = "development-narration"
        lesson = request.lesson
        script = request.script
        narration = request.narration
        cues = []
        for segment in script.get("segments", []):
            step = next(
                (
                    candidate
                    for candidate in lesson.get("steps", [])
                    if candidate["id"] == segment["stepId"]
                ),
                None,
            )
            if step is None:
                continue
            speech_segment = next(
                (
                    candidate
                    for candidate in narration.get("segments", [])
                    if candidate["scriptSegmentId"] == segment["id"]
                ),
                None,
            )
            trigger_text = (
                speech_segment.get("speechText")
                if isinstance(speech_segment, dict)
                else segment["narration"]
            )
            for line_id in segment.get("mathLineIds", []):
                cues.append(
                    {
                        "id": f"cue_{line_id}",
                        "lessonStepId": segment["stepId"],
                        "mathLineId": line_id,
                        "trigger": {
                            "type": "narration_text",
                            "scriptSegmentId": segment["id"],
                            "text": _short_trigger(str(trigger_text)),
                            "occurrence": None,
                        },
                        "visual": {
                            "action": "write_math",
                            "target": {
                                "lessonStepId": segment["stepId"],
                                "mathLineId": line_id,
                                "fragment": None,
                            },
                            "text": None,
                            "metadata": {},
                        },
                        "sync": {"mode": "with_narration"},
                        "metadata": {},
                    }
                )
                break
        return AnimationPlan.model_validate(
            {
                "lessonArtifactId": lesson_artifact_id,
                "narrationArtifactId": narration_artifact_id,
                "durationSeconds": narration.get("durationSeconds"),
                "cues": cues,
                "metadata": {"provider": "development"},
            }
        )


def _short_trigger(text: str) -> str:
    sentence = text.split(".")[0].strip()
    words = sentence.split()
    return " ".join(words[: min(len(words), 10)])
