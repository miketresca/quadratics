from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.schemas.narration import AudioAlignment


@dataclass(frozen=True)
class NarrationRequest:
    step_id: str
    text: str
    voice_id: str | None = None


@dataclass(frozen=True)
class NarrationResult:
    provider: str
    audio_base64: str
    audio_mime_type: str
    duration_seconds: float | None = None
    alignment: AudioAlignment | None = None
    normalized_alignment: AudioAlignment | None = None
    provider_metadata: dict[str, object] | None = None


class NarrationProvider(ABC):
    @abstractmethod
    async def generate(self, request: NarrationRequest) -> NarrationResult:
        """Generate narration for one teaching step."""
