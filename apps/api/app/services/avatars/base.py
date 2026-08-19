from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class AvatarVideoRequest:
    generation_job_id: str
    avatar_id: str
    audio_url: str
    title: str
    avatar_model: str = "avatar_iii"
    output_format: str = "webm"
    script_segment_id: str | None = None


@dataclass(frozen=True)
class AvatarVideoResult:
    content: bytes
    content_type: str
    duration_seconds: float
    provider_video_id: str | None
    output_format: str
    provider_metadata: dict[str, object]


class AvatarVideoProvider(ABC):
    @abstractmethod
    async def generate(self, request: AvatarVideoRequest) -> AvatarVideoResult:
        """Generate an avatar video from a completed narration audio URL."""
