import json
from typing import Any

from app.schemas.lesson_context import RealWorldContext
from app.services.context.base import RealWorldContextProvider, RealWorldContextRequest


class RealWorldContextProviderConfigurationError(RuntimeError):
    pass


REAL_WORLD_CONTEXT_JSON_SCHEMA: dict[str, Any] = {
    "name": "real_world_context",
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["status", "title", "scenario", "takeaway"],
        "properties": {
            "status": {"type": "string", "enum": ["completed"]},
            "title": {"type": "string", "minLength": 1, "maxLength": 80},
            "scenario": {"type": "string", "minLength": 1, "maxLength": 700},
            "takeaway": {"type": "string", "minLength": 1, "maxLength": 240},
        },
    },
    "strict": True,
}


class OpenAIRealWorldContextProvider(RealWorldContextProvider):
    def __init__(self, *, api_key: str, model: str, client: Any | None = None) -> None:
        if not api_key and client is None:
            raise RealWorldContextProviderConfigurationError(
                "OPENAI_API_KEY is required for real-world context generation"
            )
        self.model = model
        if client is not None:
            self.client = client
            return

        try:
            from openai import AsyncOpenAI
        except ImportError as error:
            raise RealWorldContextProviderConfigurationError(
                "The openai package is required for real-world context generation"
            ) from error

        self.client = AsyncOpenAI(api_key=api_key)

    async def generate(self, request: RealWorldContextRequest) -> RealWorldContext:
        response = await self.client.responses.create(
            model=self.model,
            input=[
                {"role": "system", "content": request.prompt},
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "audience": "9th-grade Algebra 1 student",
                            "wordBudget": request.word_budget,
                            "lesson": request.lesson,
                        }
                    ),
                },
            ],
            text={
                "format": {
                    "type": "json_schema",
                    **REAL_WORLD_CONTEXT_JSON_SCHEMA,
                }
            },
        )
        context = RealWorldContext.model_validate_json(_response_text(response))
        context.provider_metadata = {"model": self.model, **_response_usage(response)}
        return context


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

    raise ValueError("OpenAI response did not contain real-world context JSON text")


def _response_usage(response: Any) -> dict[str, int]:
    usage = getattr(response, "usage", None)
    if usage is None:
        return {}
    result: dict[str, int] = {}
    input_tokens = _usage_value(usage, "input_tokens")
    output_tokens = _usage_value(usage, "output_tokens")
    if input_tokens is not None:
        result["inputTokens"] = input_tokens
    if output_tokens is not None:
        result["outputTokens"] = output_tokens
    return result


def _usage_value(usage: Any, key: str) -> int | None:
    value = usage.get(key) if isinstance(usage, dict) else getattr(usage, key, None)
    return value if isinstance(value, int) else None
