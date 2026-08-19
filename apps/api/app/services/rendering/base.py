from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class RenderRequest:
    generation_job_id: str
    timeline_artifact_id: str
    duration_seconds: float


@dataclass(frozen=True)
class RenderResult:
    content: bytes
    content_type: str
    duration_seconds: float
    renderer_version: str


class MotionCanvasRenderer(ABC):
    @abstractmethod
    def render(self, request: RenderRequest) -> RenderResult:
        """Render a Motion Canvas timeline into a base educational video."""
