from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class AvatarRequest:
    step_id: str
    narration_audio_uri: str
    avatar_id: str | None = None


@dataclass(frozen=True)
class AvatarResult:
    video_uri: str
    duration_seconds: float | None = None


class AvatarProvider(ABC):
    @abstractmethod
    async def generate(self, request: AvatarRequest) -> AvatarResult:
        """Generate avatar media for one teaching step."""
