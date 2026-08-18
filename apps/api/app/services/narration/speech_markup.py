from abc import ABC, abstractmethod

from app.schemas.script import LessonScript


class SpeechMarkupRequest:
    def __init__(self, *, script: LessonScript) -> None:
        self.script = script


class SpeechMarkupProvider(ABC):
    @abstractmethod
    async def prepare(self, request: SpeechMarkupRequest) -> str:
        """Prepare completed script text for speech synthesis."""


class DeterministicSpeechMarkupProvider(SpeechMarkupProvider):
    async def prepare(self, request: SpeechMarkupRequest) -> str:
        return deterministic_speech_text(request.script)


def deterministic_speech_text(script: LessonScript) -> str:
    if script.status != "completed":
        raise ValueError("Only completed scripts can be prepared for narration")

    segments: list[str] = []
    for segment in script.segments:
        narration = segment.narration.strip()
        if narration:
            segments.append(narration)
    return ' <break time="0.7s" /> '.join(segments)
