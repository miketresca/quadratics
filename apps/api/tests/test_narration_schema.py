import pytest
from pydantic import ValidationError

from app.schemas.narration import LessonNarration, NarrationSegment


def test_failed_narration_can_include_preserved_segments():
    narration = LessonNarration(
        status="failed",
        provider="elevenlabs",
        speech_text="First segment. Second segment attempt.",
        unsupported_reason="ElevenLabs failed on the second segment.",
        segments=[
            NarrationSegment(
                script_segment_id="script_factor",
                step_id="factor",
                title="Factor the quadratic",
                provider="elevenlabs",
                voice_id="male-voice",
                model_id="eleven_multilingual_v2",
                audio_mime_type="audio/mpeg",
                audio_base64="ZmFrZQ==",
                speech_text="First segment.",
            )
        ],
    )

    assert narration.status == "failed"
    assert narration.segments[0].script_segment_id == "script_factor"


def test_unsupported_narration_rejects_segments():
    with pytest.raises(ValidationError):
        LessonNarration(
            status="unsupported",
            provider="elevenlabs",
            unsupported_reason="Unsupported output mode.",
            segments=[
                NarrationSegment(
                    script_segment_id="script_factor",
                    step_id="factor",
                    title="Factor the quadratic",
                    provider="elevenlabs",
                    voice_id="male-voice",
                    model_id="eleven_multilingual_v2",
                    audio_mime_type="audio/mpeg",
                    audio_base64="ZmFrZQ==",
                    speech_text="First segment.",
                )
            ],
        )
