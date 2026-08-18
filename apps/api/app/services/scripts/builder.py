from pathlib import Path

from app.schemas.lesson import LessonResponse
from app.schemas.script import LessonScript, OutputMode
from app.services.scripts.base import ScriptGenerationRequest, ScriptProvider
from app.services.scripts.validator import validate_script_for_lesson

PROMPT_PATH = Path(__file__).parent / "prompts" / "factoring_teacher_script.md"


def unsupported_script(reason: str) -> LessonScript:
    return LessonScript(
        status="unsupported",
        method=None,
        unsupported_reason=reason,
    )


async def build_lesson_script(
    *,
    lesson: LessonResponse,
    provider: ScriptProvider,
    instructor_id: str | None,
    output_mode: OutputMode,
    word_budget: int,
) -> LessonScript:
    if lesson.status != "completed" or lesson.method != "factoring":
        return unsupported_script(
            lesson.unsupported_reason
            or "Script generation is currently supported only for clean factoring lessons."
        )

    request = ScriptGenerationRequest(
        lesson=lesson.model_dump(mode="json", by_alias=True),
        instructor_id=instructor_id,
        output_mode=output_mode,
        prompt=PROMPT_PATH.read_text(encoding="utf-8"),
        word_budget=word_budget,
    )
    script = await provider.generate_lesson_script(request)
    validate_script_for_lesson(script, lesson, word_budget)
    return script
