import json

import pytest

from app.providers.openai.script_provider import (
    OpenAIScriptProvider,
    ScriptProviderConfigurationError,
)
from app.services.scripts.base import ScriptGenerationRequest


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


def test_openai_provider_requires_api_key_without_client():
    with pytest.raises(ScriptProviderConfigurationError):
        OpenAIScriptProvider(api_key="", model="gpt-5-mini")


@pytest.mark.asyncio
async def test_openai_provider_requests_structured_script_json():
    output_text = json.dumps(
        {
            "status": "completed",
            "method": "factoring",
            "totalEstimatedSeconds": 12,
            "totalWordCount": 4,
            "segments": [
                {
                    "id": "script_factor",
                    "stepId": "factor",
                    "title": "Factor",
                    "narration": "Factor the quadratic first.",
                    "mathLineIds": ["standard_form"],
                    "estimatedSeconds": 12,
                    "wordCount": 4,
                    "deliveryNotes": [],
                }
            ],
        }
    )
    client = FakeClient(output_text)
    provider = OpenAIScriptProvider(api_key="", model="gpt-5-mini", client=client)

    script = await provider.generate_lesson_script(
        ScriptGenerationRequest(
            lesson={"method": "factoring"},
            instructor_id="male",
            output_mode="video_audio",
            prompt="Prompt",
            word_budget=150,
        )
    )

    assert script.status == "completed"
    assert script.provider_metadata == {"model": "gpt-5-mini"}
    call = client.responses.calls[0]
    assert call["model"] == "gpt-5-mini"
    assert call["text"]["format"]["type"] == "json_schema"
    assert "wordBudget" in call["input"][1]["content"]
