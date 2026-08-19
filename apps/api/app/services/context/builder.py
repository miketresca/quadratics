from pathlib import Path

from app.schemas.lesson import LessonResponse
from app.schemas.lesson_context import RealWorldContext
from app.services.context.base import RealWorldContextProvider, RealWorldContextRequest

PROMPT_PATH = Path(__file__).parent / "prompts" / "real_world_context.md"


def unsupported_context(reason: str) -> RealWorldContext:
    return RealWorldContext(status="unsupported", unsupported_reason=reason)


async def build_real_world_context(
    *,
    lesson: LessonResponse,
    provider: RealWorldContextProvider,
    word_budget: int,
) -> RealWorldContext:
    if lesson.status != "completed":
        return unsupported_context(
            lesson.unsupported_reason
            or "Real-world context is available only after a completed lesson exists."
        )

    request = RealWorldContextRequest(
        lesson=lesson.model_dump(mode="json", by_alias=True),
        prompt=PROMPT_PATH.read_text(encoding="utf-8"),
        word_budget=word_budget,
    )
    return await provider.generate(request)
