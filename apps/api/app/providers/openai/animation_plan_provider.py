import json
from typing import Any

from app.schemas.animation import AnimationPlan
from app.services.animation.base import AnimationPlanningRequest, AnimationPlanProvider


class AnimationPlanProviderConfigurationError(RuntimeError):
    pass


EMPTY_OBJECT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": [],
    "properties": {},
}


ANIMATION_PLAN_JSON_SCHEMA: dict[str, Any] = {
    "name": "animation_plan",
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "version",
            "lessonArtifactId",
            "narrationArtifactId",
            "durationSeconds",
            "layout",
            "cues",
            "soundCues",
            "metadata",
        ],
        "properties": {
            "version": {"type": "string", "enum": ["animation-plan/v1"]},
            "lessonArtifactId": {"type": "string", "minLength": 1},
            "narrationArtifactId": {"type": "string", "minLength": 1},
            "durationSeconds": {"type": ["number", "null"], "minimum": 0},
            "layout": {
                "type": "object",
                "additionalProperties": False,
                "required": ["theme", "verticalFlow"],
                "properties": {
                    "theme": {"type": "string", "enum": ["chalkboard"]},
                    "verticalFlow": {"type": "boolean"},
                },
            },
            "cues": {
                "type": "array",
                "minItems": 1,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": [
                        "id",
                        "lessonStepId",
                        "mathLineId",
                        "trigger",
                        "visual",
                        "sync",
                        "metadata",
                    ],
                    "properties": {
                        "id": {"type": "string", "minLength": 1},
                        "lessonStepId": {"type": "string", "minLength": 1},
                        "mathLineId": {"type": ["string", "null"]},
                        "trigger": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["type", "scriptSegmentId", "text", "occurrence"],
                            "properties": {
                                "type": {"type": "string", "enum": ["narration_text"]},
                                "scriptSegmentId": {"type": "string", "minLength": 1},
                                "text": {"type": "string", "minLength": 1},
                                "occurrence": {"type": ["integer", "null"], "minimum": 1},
                            },
                        },
                        "visual": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["action", "target", "text", "metadata"],
                            "properties": {
                                "action": {
                                    "type": "string",
                                    "enum": [
                                        "write_math",
                                        "write_text",
                                        "highlight",
                                        "emphasize",
                                        "circle",
                                        "underline",
                                        "box",
                                        "arrow",
                                        "erase_annotation",
                                        "replace_fragment",
                                        "pause",
                                        "point",
                                        "dim",
                                        "restore",
                                    ],
                                },
                                "target": {
                                    "type": ["object", "null"],
                                    "additionalProperties": False,
                                    "required": ["lessonStepId", "mathLineId", "fragment"],
                                    "properties": {
                                        "lessonStepId": {"type": ["string", "null"]},
                                        "mathLineId": {"type": ["string", "null"]},
                                        "fragment": {"type": ["string", "null"]},
                                    },
                                },
                                "text": {"type": ["string", "null"]},
                                "metadata": EMPTY_OBJECT_SCHEMA,
                            },
                        },
                        "sync": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["mode"],
                            "properties": {
                                "mode": {
                                    "type": "string",
                                    "enum": [
                                        "before_narration",
                                        "with_narration",
                                        "after_narration",
                                        "through_narration",
                                    ],
                                }
                            },
                        },
                        "metadata": EMPTY_OBJECT_SCHEMA,
                    },
                },
            },
            "soundCues": {
                "type": "array",
                "maxItems": 0,
                "items": EMPTY_OBJECT_SCHEMA,
            },
            "metadata": EMPTY_OBJECT_SCHEMA,
        },
    },
    "strict": True,
}


class OpenAIAnimationPlanProvider(AnimationPlanProvider):
    def __init__(self, *, api_key: str, model: str, client: Any | None = None) -> None:
        if not api_key and client is None:
            raise AnimationPlanProviderConfigurationError(
                "OPENAI_API_KEY is required for animation planning"
            )
        self.model = model
        if client is not None:
            self.client = client
            return

        try:
            from openai import AsyncOpenAI
        except ImportError as error:
            raise AnimationPlanProviderConfigurationError(
                "The openai package is required for animation planning"
            ) from error

        self.client = AsyncOpenAI(api_key=api_key)

    async def generate_animation_plan(self, request: AnimationPlanningRequest) -> AnimationPlan:
        response = await self.client.responses.create(
            model=self.model,
            input=[
                {"role": "system", "content": request.prompt},
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "lesson": request.lesson,
                            "script": request.script,
                            "narration": request.narration,
                            "supportedPrimitives": request.supported_primitives,
                        }
                    ),
                },
            ],
            text={
                "format": {
                    "type": "json_schema",
                    **ANIMATION_PLAN_JSON_SCHEMA,
                }
            },
        )
        plan = AnimationPlan.model_validate_json(_response_text(response))
        plan.metadata = {**plan.metadata, "model": self.model, **_response_usage(response)}
        return plan


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

    raise ValueError("OpenAI response did not contain animation plan JSON text")


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
