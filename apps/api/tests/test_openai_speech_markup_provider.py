import json

import pytest

from app.providers.openai.speech_markup_provider import (
    OpenAISpeechMarkupProvider,
    SpeechMarkupProviderConfigurationError,
)
from app.schemas.script import LessonScript, ScriptSegment
from app.services.narration.speech_markup import SpeechMarkupRequest


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


def test_openai_speech_markup_provider_requires_api_key_without_client():
    with pytest.raises(SpeechMarkupProviderConfigurationError):
        OpenAISpeechMarkupProvider(api_key="", model="gpt-5-mini")


@pytest.mark.asyncio
async def test_openai_speech_markup_provider_requests_conversational_spoken_math():
    client = FakeClient(
        json.dumps(
            {
                "speechText": (
                    "<speak>x squared minus x equals zero."
                    '<break time="0.7s"/>'
                    "Now set each factor equal to zero.</speak>"
                )
            }
        )
    )
    provider = OpenAISpeechMarkupProvider(api_key="", model="gpt-5-mini", client=client)

    speech_text = await provider.prepare(
        SpeechMarkupRequest(
            script=LessonScript(
                status="completed",
                method="factoring",
                segments=[
                    ScriptSegment(
                        id="script_factor",
                        step_id="factor",
                        title="Factor",
                        narration="Factor (x - 1)*(x) = 0.",
                        math_line_ids=["factored_form"],
                        estimated_seconds=5,
                        word_count=5,
                    )
                ],
            )
        )
    )

    call = client.responses.calls[0]
    system_prompt = call["input"][0]["content"]
    assert "conversational speech" in system_prompt
    assert "convert symbolic math into spoken algebra" in system_prompt
    assert "Never say 'open parenthesis'" in system_prompt
    assert call["text"]["format"]["type"] == "json_schema"
    assert speech_text.startswith("<speak>x squared minus x equals zero.")
