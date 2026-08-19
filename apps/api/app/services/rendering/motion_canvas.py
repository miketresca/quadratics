import json
import os
import shlex
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory

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


class MotionCanvasRenderError(RuntimeError):
    pass


class CommandMotionCanvasRenderer(MotionCanvasRenderer):
    def __init__(
        self,
        *,
        command: str,
        timeout_seconds: int,
        cwd: str | None = None,
    ) -> None:
        if not command.strip():
            raise MotionCanvasRenderError("Motion Canvas render command is not configured")
        self._command = command
        self._timeout_seconds = timeout_seconds
        self._cwd = cwd

    def render(self, request: RenderRequest) -> RenderResult:
        with TemporaryDirectory(prefix="quadratics-render-") as temp_dir:
            input_path = Path(temp_dir) / "render-input.json"
            output_path = Path(temp_dir) / "output.mp4"
            input_path.write_text(json.dumps(request.render_input), encoding="utf-8")
            env = {
                **os.environ,
                "QUADRATICS_RENDER_INPUT_PATH": str(input_path),
                "QUADRATICS_RENDER_OUTPUT_PATH": str(output_path),
            }
            try:
                completed = subprocess.run(
                    shlex.split(self._command),
                    cwd=self._cwd,
                    env=env,
                    capture_output=True,
                    timeout=self._timeout_seconds,
                    check=False,
                )
            except subprocess.TimeoutExpired as exc:
                raise MotionCanvasRenderError(
                    f"Motion Canvas render timed out after {self._timeout_seconds} seconds"
                ) from exc
            if completed.returncode != 0:
                stderr = completed.stderr.decode(errors="replace").strip()
                stdout = completed.stdout.decode(errors="replace").strip()
                detail = stderr or stdout or f"exit code {completed.returncode}"
                raise MotionCanvasRenderError(f"Motion Canvas render failed: {detail}")
            if not output_path.exists():
                raise MotionCanvasRenderError(
                    "Motion Canvas render command did not produce output.mp4"
                )
            return RenderResult(
                content=output_path.read_bytes(),
                content_type="video/mp4",
                duration_seconds=request.duration_seconds,
                renderer_version="motion-canvas-command-v1",
            )
