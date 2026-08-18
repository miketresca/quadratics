from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class NarrationRequest:
    step_id: str
    text: str
    voice_id: str | None = None


@dataclass(frozen=True)
class NarrationResult:
    audio_uri: str
    duration_seconds: float | None = None


class NarrationProvider(ABC):
    @abstractmethod
    async def generate(self, request: NarrationRequest) -> NarrationResult:
        """Generate narration for one teaching step."""
