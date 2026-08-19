from collections.abc import Iterable
from typing import Literal

from app.schemas.narration import LessonNarration, NarrationSegment
from app.schemas.script import LessonScript, OutputMode, ScriptSegment
from app.services.narration.base import NarrationProvider, NarrationRequest
from app.services.narration.speech_markup import SpeechMarkupProvider, SpeechMarkupRequest


def unsupported_narration(reason: str, *, speech_text: str | None = None) -> LessonNarration:
    return LessonNarration(
        status="unsupported",
        provider=None,
        speech_text=speech_text,
        unsupported_reason=reason,
    )


def failed_narration(
    reason: str,
    *,
    speech_text: str | None = None,
    segments: list[NarrationSegment] | None = None,
) -> LessonNarration:
    narration_segments = segments or []
    return LessonNarration(
        status="failed",
        provider=_provider_name_for_segments(narration_segments),
        speech_text=speech_text,
        segments=narration_segments,
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
    script_segment_id: str | None = None,
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

    script_segments = _selected_script_segments(script, script_segment_id)
    narration_segments: list[NarrationSegment] = []
    speech_texts: list[str] = []
    try:
        for segment in script_segments:
            segment_script = _script_for_segment(script, segment)
            speech_text = await speech_markup_provider.prepare(
                SpeechMarkupRequest(script=segment_script)
            )
            speech_texts.append(speech_text)
            result = await provider.generate(
                NarrationRequest(
                    step_id=segment.step_id,
                    text=speech_text,
                    voice_id=voice_id,
                )
            )
            narration_segments.append(
                NarrationSegment(
                    script_segment_id=segment.id,
                    step_id=segment.step_id,
                    title=segment.title,
                    provider=result.provider,
                    voice_id=voice_id,
                    model_id=model_id,
                    audio_mime_type=result.audio_mime_type,
                    audio_base64=result.audio_base64,
                    duration_seconds=result.duration_seconds,
                    speech_text=speech_text,
                    alignment=result.alignment,
                    normalized_alignment=result.normalized_alignment,
                    provider_metadata=result.provider_metadata or {},
                )
            )
    except RuntimeError as exc:
        return failed_narration(
            str(exc),
            speech_text=_join_speech_texts(speech_texts),
            segments=narration_segments,
        )

    speech_text = _join_speech_texts(segment.speech_text for segment in narration_segments)
    duration_seconds = _sum_durations(narration_segments)
    first_segment = narration_segments[0] if len(narration_segments) == 1 else None
    return LessonNarration(
        status="completed",
        provider=_provider_name_for_segments(narration_segments),
        voice_id=voice_id,
        model_id=model_id,
        audio_mime_type=first_segment.audio_mime_type if first_segment else None,
        audio_base64=first_segment.audio_base64 if first_segment else None,
        duration_seconds=duration_seconds,
        speech_text=speech_text,
        segments=narration_segments,
        alignment=first_segment.alignment if first_segment else None,
        normalized_alignment=first_segment.normalized_alignment if first_segment else None,
        provider_metadata={"model": model_id, "segmentCount": len(narration_segments)},
    )


def _selected_script_segments(
    script: LessonScript,
    script_segment_id: str | None,
) -> list[ScriptSegment]:
    if script_segment_id is None:
        return script.segments
    for segment in script.segments:
        if segment.id == script_segment_id:
            return [segment]
    raise ValueError(f"Script segment '{script_segment_id}' was not found.")


def _script_for_segment(script: LessonScript, segment: ScriptSegment) -> LessonScript:
    return LessonScript(
        status="completed",
        method=script.method,
        total_estimated_seconds=segment.estimated_seconds,
        total_word_count=segment.word_count,
        segments=[segment],
        provider_metadata=script.provider_metadata,
    )


def _join_speech_texts(speech_texts: Iterable[str]) -> str | None:
    text = " ".join(text for text in speech_texts if text).strip()
    return text or None


def _sum_durations(segments: list[NarrationSegment]) -> float | None:
    durations = [
        segment.duration_seconds
        for segment in segments
        if segment.duration_seconds is not None
    ]
    if not durations:
        return None
    return sum(durations)


def _provider_name_for_segments(
    segments: list[NarrationSegment],
) -> Literal["elevenlabs", "development"] | None:
    providers = {segment.provider for segment in segments}
    return providers.pop() if len(providers) == 1 else None
