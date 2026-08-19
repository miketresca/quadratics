import sys

import pytest

from app.services.rendering.base import RenderRequest
from app.services.rendering.motion_canvas import (
    CommandMotionCanvasRenderer,
    MotionCanvasRenderError,
)


def test_command_motion_canvas_renderer_reads_configured_output(tmp_path):
    script = tmp_path / "render.py"
    script.write_text(
        "import os\n"
        "from pathlib import Path\n"
        "assert Path(os.environ['QUADRATICS_RENDER_INPUT_PATH']).exists()\n"
        "Path(os.environ['QUADRATICS_RENDER_OUTPUT_PATH']).write_bytes(b'fake-mp4')\n",
        encoding="utf-8",
    )
    renderer = CommandMotionCanvasRenderer(
        command=f"{sys.executable} {script}",
        timeout_seconds=5,
    )

    result = renderer.render(
        RenderRequest(
            generation_job_id="generation-1",
            timeline_artifact_id="timeline-1",
            duration_seconds=2.5,
            render_input={"lesson": {}, "timeline": {}, "narration": {}},
        )
    )

    assert result.content == b"fake-mp4"
    assert result.content_type == "video/mp4"
    assert result.duration_seconds == 2.5
    assert result.renderer_version == "motion-canvas-command-v1"


def test_command_motion_canvas_renderer_fails_when_output_is_missing(tmp_path):
    script = tmp_path / "render.py"
    script.write_text("pass\n", encoding="utf-8")
    renderer = CommandMotionCanvasRenderer(
        command=f"{sys.executable} {script}",
        timeout_seconds=5,
    )

    with pytest.raises(MotionCanvasRenderError, match="did not produce output"):
        renderer.render(
            RenderRequest(
                generation_job_id="generation-1",
                timeline_artifact_id="timeline-1",
                duration_seconds=2.5,
                render_input={"lesson": {}, "timeline": {}, "narration": {}},
            )
        )


def test_command_motion_canvas_renderer_wraps_timeout(tmp_path):
    script = tmp_path / "render.py"
    script.write_text("import time\ntime.sleep(2)\n", encoding="utf-8")
    renderer = CommandMotionCanvasRenderer(
        command=f"{sys.executable} {script}",
        timeout_seconds=1,
    )

    with pytest.raises(MotionCanvasRenderError, match="timed out"):
        renderer.render(
            RenderRequest(
                generation_job_id="generation-1",
                timeline_artifact_id="timeline-1",
                duration_seconds=2.5,
                render_input={"lesson": {}, "timeline": {}, "narration": {}},
            )
        )


def test_command_motion_canvas_renderer_wraps_spawn_errors():
    renderer = CommandMotionCanvasRenderer(
        command="/path/to/missing-motion-canvas-command",
        timeout_seconds=5,
    )

    with pytest.raises(MotionCanvasRenderError, match="could not start"):
        renderer.render(
            RenderRequest(
                generation_job_id="generation-1",
                timeline_artifact_id="timeline-1",
                duration_seconds=2.5,
                render_input={"lesson": {}, "timeline": {}, "narration": {}},
            )
        )
