from __future__ import annotations

from dataclasses import dataclass

from app.schemas.animation import (
    AnimationCue,
    AnimationPlan,
    ResolvedAnimationCue,
    ResolvedAnimationTimeline,
    ResolvedAnimationWindow,
    ResolvedNarrationSpan,
    ResolvedSfxWindow,
)
from app.schemas.narration import AudioAlignment, LessonNarration, NarrationSegment
from app.services.animation.text_normalization import normalize_with_index_map


class TimelineResolutionError(ValueError):
    pass


@dataclass(frozen=True)
class TimingDefaults:
    lead_time_seconds: float = 0.35
    after_delay_seconds: float = 0.2
    minimum_write_duration_seconds: float = 0.45
    maximum_write_duration_seconds: float = 2.2


def resolve_animation_timeline(
    plan: AnimationPlan,
    *,
    narration: LessonNarration,
    timing: TimingDefaults | None = None,
) -> ResolvedAnimationTimeline:
    if narration.status != "completed":
        raise TimelineResolutionError("completed narration is required")
    defaults = timing or TimingDefaults()
    segment_by_id = {segment.script_segment_id: segment for segment in narration.segments}
    resolved_cues = [
        _resolve_cue(cue, segment_by_id=segment_by_id, timing=defaults)
        for cue in plan.cues
    ]
    resolved_cues.sort(
        key=lambda cue: (
            cue.animation.start_seconds,
            cue.animation.end_seconds,
            cue.cue_id,
        )
    )
    duration = narration.duration_seconds
    if duration is None:
        duration = max((cue.animation.end_seconds for cue in resolved_cues), default=0)
    return ResolvedAnimationTimeline(
        narration_artifact_id=plan.narration_artifact_id,
        duration_seconds=duration,
        cues=resolved_cues,
    )


def _resolve_cue(
    cue: AnimationCue,
    *,
    segment_by_id: dict[str, NarrationSegment],
    timing: TimingDefaults,
) -> ResolvedAnimationCue:
    segment = segment_by_id.get(cue.trigger.script_segment_id)
    if segment is None:
        raise TimelineResolutionError(
            f"script segment '{cue.trigger.script_segment_id}' was not found in narration"
        )
    alignment = segment.normalized_alignment or segment.alignment
    if alignment is None:
        raise TimelineResolutionError(
            f"narration segment '{segment.script_segment_id}' is missing alignment"
        )
    _validate_alignment(alignment, segment.script_segment_id)
    raw_start, raw_end = _match_phrase(
        source_text="".join(alignment.characters),
        phrase=cue.trigger.text,
        occurrence=cue.trigger.occurrence,
    )
    segment_offset = float(segment.provider_metadata.get("segmentOffsetSeconds", 0))
    narration_start = alignment.character_start_times_seconds[raw_start] + segment_offset
    narration_end = alignment.character_end_times_seconds[raw_end] + segment_offset
    animation_start, animation_end = _animation_window(
        cue=cue,
        narration_start=narration_start,
        narration_end=narration_end,
        timing=timing,
    )
    sfx = None
    if cue.visual.action in {"write_math", "write_text"}:
        sfx = ResolvedSfxWindow(
            type="chalk_write",
            start_seconds=animation_start,
            end_seconds=animation_end,
        )
    return ResolvedAnimationCue(
        cue_id=cue.id,
        lesson_step_id=cue.lesson_step_id,
        math_line_id=cue.math_line_id,
        narration=ResolvedNarrationSpan(
            text=cue.trigger.text,
            start_seconds=narration_start,
            end_seconds=narration_end,
        ),
        animation=ResolvedAnimationWindow(
            action=cue.visual.action,
            start_seconds=animation_start,
            end_seconds=animation_end,
        ),
        sfx=sfx,
    )


def _validate_alignment(alignment: AudioAlignment, script_segment_id: str) -> None:
    if not alignment.characters:
        raise TimelineResolutionError(
            f"narration segment '{script_segment_id}' has empty alignment"
        )
    lengths = {
        len(alignment.characters),
        len(alignment.character_start_times_seconds),
        len(alignment.character_end_times_seconds),
    }
    if len(lengths) != 1:
        raise TimelineResolutionError(
            f"narration segment '{script_segment_id}' has malformed alignment"
        )


def _match_phrase(
    *,
    source_text: str,
    phrase: str,
    occurrence: int | None,
) -> tuple[int, int]:
    source = normalize_with_index_map(source_text)
    target = normalize_with_index_map(phrase)
    if not target.text:
        raise TimelineResolutionError("trigger phrase cannot be empty")
    matches: list[int] = []
    start = 0
    while True:
        match = source.text.find(target.text, start)
        if match == -1:
            break
        matches.append(match)
        start = match + 1
    if not matches:
        raise TimelineResolutionError(f"trigger phrase '{phrase}' was not found")
    if occurrence is None and len(matches) > 1:
        raise TimelineResolutionError(f"trigger phrase '{phrase}' is ambiguous")
    match_index = (occurrence or 1) - 1
    if match_index >= len(matches):
        raise TimelineResolutionError(
            f"trigger phrase '{phrase}' occurrence {occurrence} was not found"
        )
    normalized_start = matches[match_index]
    normalized_end = normalized_start + len(target.text) - 1
    return source.raw_indexes[normalized_start], source.raw_indexes[normalized_end]


def _animation_window(
    *,
    cue: AnimationCue,
    narration_start: float,
    narration_end: float,
    timing: TimingDefaults,
) -> tuple[float, float]:
    narration_duration = max(narration_end - narration_start, 0)
    duration = min(
        max(narration_duration, timing.minimum_write_duration_seconds),
        timing.maximum_write_duration_seconds,
    )
    mode = cue.sync.mode
    if mode in {"with_narration", "through_narration"}:
        return narration_start, max(narration_end, narration_start + duration)
    if mode == "before_narration":
        end = max(narration_start - timing.lead_time_seconds, 0)
        return max(end - duration, 0), end
    if mode == "after_narration":
        start = narration_end + timing.after_delay_seconds
        return start, start + duration
    raise TimelineResolutionError(f"unsupported sync mode '{mode}'")
