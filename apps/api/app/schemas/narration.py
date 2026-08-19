from typing import Any, Literal

from pydantic import Field, model_validator

from app.schemas.common import ApiModel

NarrationStatus = Literal["completed", "unsupported", "failed"]


class AudioAlignment(ApiModel):
    characters: list[str] = Field(default_factory=list)
    character_start_times_seconds: list[float] = Field(default_factory=list)
    character_end_times_seconds: list[float] = Field(default_factory=list)

    @model_validator(mode="after")
    def alignment_lengths_match(self) -> "AudioAlignment":
        if not (
            len(self.characters)
            == len(self.character_start_times_seconds)
            == len(self.character_end_times_seconds)
        ):
            raise ValueError("alignment arrays must have matching lengths")
        return self


class NarrationSegment(ApiModel):
    script_segment_id: str = Field(min_length=1)
    step_id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    provider: Literal["elevenlabs", "development"]
    voice_id: str
    model_id: str
    audio_mime_type: str
    audio_base64: str | None = None
    duration_seconds: float | None = Field(default=None, ge=0)
    speech_text: str = Field(min_length=1)
    alignment: AudioAlignment | None = None
    normalized_alignment: AudioAlignment | None = None
    provider_metadata: dict[str, Any] = Field(default_factory=dict)


class LessonNarration(ApiModel):
    status: NarrationStatus
    provider: Literal["elevenlabs", "development"] | None = None
    voice_id: str | None = None
    model_id: str | None = None
    audio_mime_type: str | None = None
    audio_base64: str | None = None
    duration_seconds: float | None = Field(default=None, ge=0)
    speech_text: str | None = None
    segments: list[NarrationSegment] = Field(default_factory=list)
    alignment: AudioAlignment | None = None
    normalized_alignment: AudioAlignment | None = None
    unsupported_reason: str | None = None
    provider_metadata: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def completed_narration_needs_audio(self) -> "LessonNarration":
        if self.status == "completed" and not self.audio_base64 and not self.segments:
            raise ValueError("completed narration must include audio_base64 or segments")
        if self.status != "completed" and self.audio_base64:
            raise ValueError("only completed narration may include audio_base64")
        if self.status == "unsupported" and self.segments:
            raise ValueError("unsupported narration may not include segments")
        return self
