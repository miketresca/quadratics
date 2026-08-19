from abc import ABC, abstractmethod
from typing import Any

from app.schemas.animation import AnimationPlan


class AnimationPlanningRequest:
    def __init__(
        self,
        *,
        lesson: dict[str, Any],
        script: dict[str, Any],
        narration: dict[str, Any],
        supported_primitives: list[str],
        prompt: str,
    ) -> None:
        self.lesson = lesson
        self.script = script
        self.narration = narration
        self.supported_primitives = supported_primitives
        self.prompt = prompt


class AnimationPlanProvider(ABC):
    @abstractmethod
    async def generate_animation_plan(self, request: AnimationPlanningRequest) -> AnimationPlan:
        """Generate semantic animation cues from persisted lesson/script/narration data."""
