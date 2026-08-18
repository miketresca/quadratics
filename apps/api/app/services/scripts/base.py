from abc import ABC, abstractmethod
from typing import Any

from app.schemas.script import LessonScript, OutputMode


class ScriptGenerationRequest:
    def __init__(
        self,
        *,
        lesson: dict[str, Any],
        instructor_id: str | None,
        output_mode: OutputMode,
        prompt: str,
        word_budget: int,
    ) -> None:
        self.lesson = lesson
        self.instructor_id = instructor_id
        self.output_mode = output_mode
        self.prompt = prompt
        self.word_budget = word_budget


class ScriptProvider(ABC):
    @abstractmethod
    async def generate_lesson_script(self, request: ScriptGenerationRequest) -> LessonScript:
        """Generate narration script text from deterministic lesson data."""
