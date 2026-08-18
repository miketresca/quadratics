from app.schemas.narration import LessonNarration
from app.schemas.script import LessonScript, OutputMode
from app.services.narration.base import NarrationProvider, NarrationRequest
from app.services.narration.speech_markup import SpeechMarkupProvider, SpeechMarkupRequest


def unsupported_narration(reason: str) -> LessonNarration:
    return LessonNarration(
        status="unsupported",
        provider=None,
        unsupported_reason=reason,
    )


async def build_lesson_narration(
    *,
    script: LessonScript,
    provider: NarrationProvider,
    instructor_id: str | None,
    output_mode: OutputMode,
    voice_id: str | None,
    model_id: str,
    speech_markup_provider: SpeechMarkupProvider,
) -> LessonNarration:
    if output_mode != "audio":
        return unsupported_narration(
            "Audio generation is currently available only for audio-only output."
        )
    if script.status != "completed":
        return unsupported_narration(
            script.unsupported_reason or "Audio generation requires a completed teacher script."
        )
    if not voice_id:
        return unsupported_narration(
            f"ElevenLabs voice is not configured for instructor '{instructor_id or 'male'}'."
        )

    speech_text = await speech_markup_provider.prepare(SpeechMarkupRequest(script=script))
    result = await provider.generate(
        NarrationRequest(
            step_id="teacher_script",
            text=speech_text,
            voice_id=voice_id,
        )
    )
    return LessonNarration(
        status="completed",
        provider=result.provider,
        voice_id=voice_id,
        model_id=model_id,
        audio_mime_type=result.audio_mime_type,
        audio_base64=result.audio_base64,
        duration_seconds=result.duration_seconds,
        speech_text=speech_text,
        alignment=result.alignment,
        normalized_alignment=result.normalized_alignment,
        provider_metadata=result.provider_metadata,
    )
