from app.services.rendering.base import MotionCanvasRenderer, RenderRequest, RenderResult


class DevelopmentMotionCanvasRenderer(MotionCanvasRenderer):
    def render(self, request: RenderRequest) -> RenderResult:
        return RenderResult(
            content=(
                f"development mp4 for {request.generation_job_id} "
                f"timeline {request.timeline_artifact_id}"
            ).encode(),
            content_type="video/mp4",
            duration_seconds=request.duration_seconds,
            renderer_version="development-motion-canvas-v1",
        )
