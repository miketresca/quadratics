import pytest

from app.schemas.animation import AnimationPlan
from app.schemas.narration import AudioAlignment, LessonNarration, NarrationSegment
from app.services.animation.resolver import TimelineResolutionError, resolve_animation_timeline


def alignment_for(text: str, *, offset: float = 0.0, step: float = 0.1) -> AudioAlignment:
    characters = list(text)
    starts = [offset + index * step for index, _ in enumerate(characters)]
    ends = [start + step for start in starts]
    return AudioAlignment(
        characters=characters,
        character_start_times_seconds=starts,
        character_end_times_seconds=ends,
    )


def narration_segment(
    script_segment_id: str,
    text: str,
    *,
    offset: float = 0.0,
) -> NarrationSegment:
    return NarrationSegment(
        script_segment_id=script_segment_id,
        step_id="factor",
        title="Factor",
        provider="development",
        voice_id="voice",
        model_id="model",
        audio_mime_type="audio/mpeg",
        audio_base64="ZmFrZQ==",
        duration_seconds=len(text) * 0.1,
        speech_text=text,
        normalized_alignment=alignment_for(text),
        provider_metadata={"segmentOffsetSeconds": offset},
    )


def narration(*segments: NarrationSegment) -> LessonNarration:
    return LessonNarration(
        status="completed",
        provider="development",
        voice_id="voice",
        model_id="model",
        speech_text=" ".join(segment.speech_text for segment in segments),
        duration_seconds=sum(segment.duration_seconds or 0 for segment in segments),
        segments=list(segments),
    )


def plan_for(text: str, *, occurrence: int | None = None, sync_mode: str = "with_narration"):
    return AnimationPlan.model_validate(
        {
            "lessonArtifactId": "lesson-1",
            "narrationArtifactId": "narration-1",
            "cues": [
                {
                    "id": "cue_1",
                    "lessonStepId": "factor",
                    "mathLineId": "standard_form",
                    "trigger": {
                        "type": "narration_text",
                        "scriptSegmentId": "script_factor",
                        "text": text,
                        **({"occurrence": occurrence} if occurrence else {}),
                    },
                    "visual": {
                        "action": "write_math",
                        "target": {
                            "lessonStepId": "factor",
                            "mathLineId": "standard_form",
                        },
                    },
                    "sync": {"mode": sync_mode},
                }
            ],
        }
    )


def test_resolver_returns_cues_in_chronological_order():
    segment = narration_segment(
        "script_factor",
        "First write the equation. Then solve each factor.",
    )
    plan = AnimationPlan.model_validate(
        {
            "lessonArtifactId": "lesson-1",
            "narrationArtifactId": "narration-1",
            "cues": [
                {
                    "id": "cue_late",
                    "lessonStepId": "factor",
                    "mathLineId": "factored_form",
                    "trigger": {
                        "type": "narration_text",
                        "scriptSegmentId": "script_factor",
                        "text": "Then solve each factor",
                    },
                    "visual": {
                        "action": "write_math",
                        "target": {
                            "lessonStepId": "factor",
                            "mathLineId": "factored_form",
                        },
                    },
                    "sync": {"mode": "with_narration"},
                },
                {
                    "id": "cue_early",
                    "lessonStepId": "factor",
                    "mathLineId": "standard_form",
                    "trigger": {
                        "type": "narration_text",
                        "scriptSegmentId": "script_factor",
                        "text": "First write the equation",
                    },
                    "visual": {
                        "action": "write_math",
                        "target": {
                            "lessonStepId": "factor",
                            "mathLineId": "standard_form",
                        },
                    },
                    "sync": {"mode": "with_narration"},
                },
            ],
        }
    )

    timeline = resolve_animation_timeline(plan, narration=narration(segment))

    assert [cue.cue_id for cue in timeline.cues] == ["cue_early", "cue_late"]
    assert timeline.cues[0].animation.start_seconds < timeline.cues[1].animation.start_seconds


def test_resolver_reconstructs_segment_offsets_when_metadata_is_missing():
    first = narration_segment("script_factor", "First segment.", offset=0.0)
    first.provider_metadata = {}
    second = narration_segment("script_final_answer", "Final answer.")
    second.provider_metadata = {}

    timeline = resolve_animation_timeline(
        AnimationPlan.model_validate(
            {
                "lessonArtifactId": "lesson-1",
                "narrationArtifactId": "narration-1",
                "cues": [
                    {
                        "id": "cue_final",
                        "lessonStepId": "factor",
                        "mathLineId": "standard_form",
                        "trigger": {
                            "type": "narration_text",
                            "scriptSegmentId": "script_final_answer",
                            "text": "Final",
                        },
                        "visual": {
                            "action": "write_math",
                            "target": {
                                "lessonStepId": "factor",
                                "mathLineId": "standard_form",
                            },
                        },
                        "sync": {"mode": "with_narration"},
                    }
                ],
            }
        ),
        narration=narration(first, second),
    )

    assert timeline.cues[0].narration.start_seconds == pytest.approx(1.4)


def test_resolver_maps_phrase_at_beginning_middle_and_end():
    segment = narration_segment("script_factor", "Start here, then middle, then final")
    timeline = resolve_animation_timeline(
        plan_for("middle"),
        narration=narration(segment),
    )

    cue = timeline.cues[0]
    assert cue.narration.start_seconds == pytest.approx(1.7)
    assert cue.narration.end_seconds == pytest.approx(2.3)
    assert cue.animation.start_seconds == cue.narration.start_seconds


def test_resolver_handles_punctuation_and_whitespace_mismatch():
    segment = narration_segment("script_factor", "Now,   factor x plus two.")
    timeline = resolve_animation_timeline(
        plan_for("factor x plus two"),
        narration=narration(segment),
    )

    assert timeline.cues[0].narration.text == "factor x plus two"


def test_resolver_uses_occurrence_for_repeated_phrase():
    segment = narration_segment("script_factor", "factor now, then factor again")
    timeline = resolve_animation_timeline(
        plan_for("factor", occurrence=2),
        narration=narration(segment),
    )

    assert timeline.cues[0].narration.start_seconds == pytest.approx(1.7)


def test_resolver_rejects_ambiguous_repeated_phrase_without_occurrence():
    segment = narration_segment("script_factor", "factor now, then factor again")

    with pytest.raises(TimelineResolutionError, match="ambiguous"):
        resolve_animation_timeline(plan_for("factor"), narration=narration(segment))


def test_resolver_rejects_missing_phrase():
    segment = narration_segment("script_factor", "Start here")

    with pytest.raises(TimelineResolutionError, match="not found"):
        resolve_animation_timeline(plan_for("missing"), narration=narration(segment))


def test_resolver_rejects_missing_alignment():
    segment = narration_segment("script_factor", "Start here")
    segment.normalized_alignment = None

    with pytest.raises(TimelineResolutionError, match="alignment"):
        resolve_animation_timeline(plan_for("Start"), narration=narration(segment))


def test_resolver_applies_sync_mode_defaults():
    segment = narration_segment("script_factor", "Start here")
    before = resolve_animation_timeline(
        plan_for("Start", sync_mode="before_narration"),
        narration=narration(segment),
    )
    after = resolve_animation_timeline(
        plan_for("Start", sync_mode="after_narration"),
        narration=narration(segment),
    )

    assert before.cues[0].animation.end_seconds <= before.cues[0].narration.start_seconds
    assert after.cues[0].animation.start_seconds >= after.cues[0].narration.end_seconds
