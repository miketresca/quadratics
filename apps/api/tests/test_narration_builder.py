import pytest

from app.schemas.narration import AudioAlignment
from app.schemas.script import LessonScript, ScriptSegment
from app.services.narration.base import NarrationProvider, NarrationRequest, NarrationResult
from app.services.narration.builder import build_lesson_narration
from app.services.narration.speech_markup import SpeechMarkupProvider, SpeechMarkupRequest


class VerboseSpeechMarkupProvider(SpeechMarkupProvider):
    async def prepare(self, request: SpeechMarkupRequest) -> str:
        return " ".join(["extra explanation"] * 80)


class CapturingNarrationProvider(NarrationProvider):
    def __init__(self) -> None:
        self.requests: list[NarrationRequest] = []

    async def generate(self, request: NarrationRequest) -> NarrationResult:
        self.requests.append(request)
        characters = list(request.text)
        return NarrationResult(
            provider="elevenlabs",
            audio_base64="ZmFrZS1tcDM=",
            audio_mime_type="audio/mpeg",
            duration_seconds=1.2,
            normalized_alignment=AudioAlignment(
                characters=characters,
                character_start_times_seconds=[index * 0.05 for index in range(len(characters))],
                character_end_times_seconds=[
                    (index + 1) * 0.05 for index in range(len(characters))
                ],
            ),
        )


@pytest.mark.asyncio
async def test_narration_builder_falls_back_when_speech_markup_is_too_long():
    narration_provider = CapturingNarrationProvider()
    script = LessonScript(
        status="completed",
        method="factoring",
        total_estimated_seconds=6,
        total_word_count=9,
        segments=[
            ScriptSegment(
                id="script_factor",
                step_id="factor",
                title="Factor",
                narration="First, factor the quadratic into two factors.",
                math_line_ids=["standard_form", "factored_form"],
                estimated_seconds=6,
                word_count=7,
            )
        ],
    )

    narration = await build_lesson_narration(
        script=script,
        provider=narration_provider,
        instructor_id="male",
        output_mode="audio",
        voice_id="voice-1",
        model_id="eleven_multilingual_v2",
        speech_markup_provider=VerboseSpeechMarkupProvider(),
    )

    assert narration.status == "completed"
    assert len(narration_provider.requests) == 1
    assert narration_provider.requests[0].text == (
        "First, factor the quadratic into two factors."
    )
    assert narration.segments[0].provider_metadata["speechMarkupFallback"] == "too_long"
