import json
from typing import Any

from app.schemas.script import LessonScript
from app.services.narration.speech_markup import SpeechMarkupProvider, SpeechMarkupRequest


class SpeechMarkupProviderConfigurationError(RuntimeError):
    pass


SPEECH_MARKUP_SCHEMA: dict[str, Any] = {
    "name": "speech_markup",
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["speechText"],
        "properties": {
            "speechText": {"type": "string", "minLength": 1},
        },
    },
    "strict": True,
}


class OpenAISpeechMarkupProvider(SpeechMarkupProvider):
    def __init__(self, *, api_key: str, model: str, client: Any | None = None) -> None:
        if not api_key and client is None:
            raise SpeechMarkupProviderConfigurationError(
                "OPENAI_API_KEY is required for speech markup generation"
            )
        self.model = model
        if client is not None:
            self.client = client
            return

        try:
            from openai import AsyncOpenAI
        except ImportError as error:
            raise SpeechMarkupProviderConfigurationError(
                "The openai package is required for speech markup generation"
            ) from error

        self.client = AsyncOpenAI(api_key=api_key)

    async def prepare(self, request: SpeechMarkupRequest) -> str:
        response = await self.client.responses.create(
            model=self.model,
            input=[
                {
                    "role": "system",
                    "content": (
                        "Prepare a math teacher narration script for ElevenLabs text-to-speech. "
                        "Return one speechText string only. Preserve the existing meaning and "
                        "all math references. Use SSML break tags sparingly for natural pacing, "
                        "preferring 0.5s, 0.7s, or 1.0s. "
                        "Use 2.0s only for a major transition. Never use a break longer than 2.0s."
                    ),
                },
                {"role": "user", "content": json.dumps(_script_payload(request.script))},
            ],
            text={
                "format": {
                    "type": "json_schema",
                    **SPEECH_MARKUP_SCHEMA,
                }
            },
        )
        content = _response_text(response)
        payload = json.loads(content)
        speech_text = payload["speechText"].strip()
        if not speech_text:
            raise ValueError("OpenAI response did not contain speechText")
        return speech_text


def _script_payload(script: LessonScript) -> dict[str, Any]:
    return {
        "segments": [
            {
                "id": segment.id,
                "stepId": segment.step_id,
                "title": segment.title,
                "narration": segment.narration,
                "mathLineIds": segment.math_line_ids,
            }
            for segment in script.segments
        ]
    }


def _response_text(response: Any) -> str:
    output_text = getattr(response, "output_text", None)
    if isinstance(output_text, str) and output_text:
        return output_text

    output = getattr(response, "output", None)
    if output:
        for item in output:
            for content in getattr(item, "content", []) or []:
                text = getattr(content, "text", None)
                if isinstance(text, str) and text:
                    return text

    raise ValueError("OpenAI response did not contain speech markup JSON text")
