import json
from typing import Any

from app.schemas.script import LessonScript
from app.services.scripts.base import ScriptGenerationRequest, ScriptProvider


class ScriptProviderConfigurationError(RuntimeError):
    pass


SCRIPT_JSON_SCHEMA: dict[str, Any] = {
    "name": "lesson_script",
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "status",
            "method",
            "totalEstimatedSeconds",
            "totalWordCount",
            "segments",
        ],
        "properties": {
            "status": {"type": "string", "enum": ["completed"]},
            "method": {"type": "string", "enum": ["factoring"]},
            "totalEstimatedSeconds": {"type": "number", "minimum": 0},
            "totalWordCount": {"type": "integer", "minimum": 0},
            "segments": {
                "type": "array",
                "minItems": 1,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": [
                        "id",
                        "stepId",
                        "title",
                        "narration",
                        "mathLineIds",
                        "estimatedSeconds",
                        "wordCount",
                        "deliveryNotes",
                    ],
                    "properties": {
                        "id": {"type": "string", "minLength": 1},
                        "stepId": {"type": "string", "minLength": 1},
                        "title": {"type": "string", "minLength": 1},
                        "narration": {"type": "string", "minLength": 1},
                        "mathLineIds": {
                            "type": "array",
                            "minItems": 1,
                            "items": {"type": "string", "minLength": 1},
                        },
                        "estimatedSeconds": {"type": "number", "minimum": 0},
                        "wordCount": {"type": "integer", "minimum": 0},
                        "deliveryNotes": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                    },
                },
            },
        },
    },
    "strict": True,
}


class OpenAIScriptProvider(ScriptProvider):
    def __init__(self, *, api_key: str, model: str, client: Any | None = None) -> None:
        if not api_key and client is None:
            raise ScriptProviderConfigurationError(
                "OPENAI_API_KEY is required for script generation"
            )
        self.model = model
        if client is not None:
            self.client = client
            return

        try:
            from openai import AsyncOpenAI
        except ImportError as error:
            raise ScriptProviderConfigurationError(
                "The openai package is required for script generation"
            ) from error

        self.client = AsyncOpenAI(api_key=api_key)

    async def generate_lesson_script(self, request: ScriptGenerationRequest) -> LessonScript:
        response = await self.client.responses.create(
            model=self.model,
            input=[
                {"role": "system", "content": request.prompt},
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "wordBudget": request.word_budget,
                            "instructorId": request.instructor_id,
                            "outputMode": request.output_mode,
                            "lesson": request.lesson,
                        }
                    ),
                },
            ],
            text={
                "format": {
                    "type": "json_schema",
                    **SCRIPT_JSON_SCHEMA,
                }
            },
        )
        content = _response_text(response)
        script = LessonScript.model_validate_json(content)
        script.provider_metadata = {"model": self.model, **_response_usage(response)}
        return script


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

    raise ValueError("OpenAI response did not contain script JSON text")


def _response_usage(response: Any) -> dict[str, int]:
    usage = getattr(response, "usage", None)
    if usage is None:
        return {}
    input_tokens = _usage_value(usage, "input_tokens")
    output_tokens = _usage_value(usage, "output_tokens")
    result: dict[str, int] = {}
    if input_tokens is not None:
        result["inputTokens"] = input_tokens
    if output_tokens is not None:
        result["outputTokens"] = output_tokens
    return result


def _usage_value(usage: Any, key: str) -> int | None:
    value = usage.get(key) if isinstance(usage, dict) else getattr(usage, key, None)
    return value if isinstance(value, int) else None
