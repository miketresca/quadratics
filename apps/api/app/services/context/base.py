from abc import ABC, abstractmethod
from typing import Any

from app.schemas.lesson_context import RealWorldContext


class RealWorldContextRequest:
    """Provider input for the optional real-world lesson context artifact."""

    def __init__(
        self,
        *,
        lesson: dict[str, Any],
        prompt: str,
        word_budget: int,
    ) -> None:
        self.lesson = lesson
        self.prompt = prompt
        self.word_budget = word_budget


class RealWorldContextProvider(ABC):
    @abstractmethod
    async def generate(self, request: RealWorldContextRequest) -> RealWorldContext:
        """Generate a compact real-world example from deterministic lesson data."""
