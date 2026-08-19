import json

import pytest

from app.providers.openai.animation_plan_provider import (
    ANIMATION_PLAN_JSON_SCHEMA,
    AnimationPlanProviderConfigurationError,
    OpenAIAnimationPlanProvider,
)
from app.services.animation.base import AnimationPlanningRequest


class FakeResponses:
    def __init__(self, output_text: str) -> None:
        self.output_text = output_text
        self.calls = []

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        return type("Response", (), {"output_text": self.output_text})()


class FakeClient:
    def __init__(self, output_text: str) -> None:
        self.responses = FakeResponses(output_text)


def valid_plan_json() -> str:
    return json.dumps(
        {
            "version": "animation-plan/v1",
            "lessonArtifactId": "placeholder-lesson",
            "narrationArtifactId": "placeholder-narration",
            "durationSeconds": 10,
            "layout": {"theme": "chalkboard", "verticalFlow": True},
            "cues": [
                {
                    "id": "cue_1",
                    "lessonStepId": "factor",
                    "mathLineId": "standard_form",
                    "trigger": {
                        "type": "narration_text",
                        "scriptSegmentId": "script_factor",
                        "text": "Start with x squared",
                        "occurrence": None,
                    },
                    "visual": {
                        "action": "write_math",
                        "target": {
                            "lessonStepId": "factor",
                            "mathLineId": "standard_form",
                            "fragment": None,
                        },
                        "text": None,
                        "metadata": {},
                    },
                    "sync": {"mode": "with_narration"},
                    "metadata": {},
                }
            ],
            "soundCues": [],
            "metadata": {},
        }
    )


def test_openai_animation_plan_provider_requires_api_key_without_client():
    with pytest.raises(AnimationPlanProviderConfigurationError):
        OpenAIAnimationPlanProvider(api_key="", model="gpt-5-mini")


def test_animation_plan_schema_uses_closed_objects_for_openai_strict_mode():
    assert_closed_object_schema(ANIMATION_PLAN_JSON_SCHEMA["schema"])


@pytest.mark.asyncio
async def test_openai_animation_plan_provider_requests_structured_json():
    client = FakeClient(valid_plan_json())
    provider = OpenAIAnimationPlanProvider(api_key="", model="gpt-5-mini", client=client)

    plan = await provider.generate_animation_plan(
        AnimationPlanningRequest(
            lesson={"steps": []},
            script={"segments": []},
            narration={"speechText": "Start with x squared"},
            supported_primitives=["write_math"],
            prompt="Prompt",
        )
    )

    assert plan.metadata == {"model": "gpt-5-mini"}
    call = client.responses.calls[0]
    assert call["model"] == "gpt-5-mini"
    assert call["text"]["format"]["name"] == "animation_plan"
    assert "supportedPrimitives" in call["input"][1]["content"]


def assert_closed_object_schema(schema: object) -> None:
    if not isinstance(schema, dict):
        return
    schema_type = schema.get("type")
    if schema_type == "object" or (
        isinstance(schema_type, list) and "object" in schema_type
    ):
        assert schema.get("additionalProperties") is False
        properties = schema.get("properties", {})
        assert isinstance(properties, dict)
        assert sorted(schema.get("required", [])) == sorted(properties)
    for value in schema.values():
        if isinstance(value, dict):
            assert_closed_object_schema(value)
        elif isinstance(value, list):
            for item in value:
                assert_closed_object_schema(item)
