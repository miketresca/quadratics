from types import SimpleNamespace

import pytest

from app.services.game_lessons.providers import OpenAIGameLessonStageProvider


class _FakeResponses:
    def __init__(self, payload: str) -> None:
        self.payload = payload
        self.calls = []

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(
            output_text=self.payload,
            usage=SimpleNamespace(input_tokens=100, output_tokens=25),
        )


class _FakeClient:
    def __init__(self, payload: str) -> None:
        self.responses = _FakeResponses(payload)


@pytest.mark.asyncio
async def test_openai_game_lesson_provider_generates_section_script_with_usage():
    client = _FakeClient(
        """
        {
          "summary": "Draft section narration.",
          "scriptVersion": 1,
          "targetTotalSeconds": 90,
          "audience": "sixth grade math students",
          "sourceTemplateId": "volume-cubes-lesson-1",
          "sections": [
            {
              "sectionId": "do_now",
              "title": "Do Now",
              "targetDurationSeconds": 30,
              "regionId": "page_1_do_now",
              "questionIds": ["do_now_1"],
              "fillTargetIds": ["do_now_1_answer"],
              "narration": "Count the cubes carefully.",
              "approvalRequired": true
            }
          ]
        }
        """
    )
    provider = OpenAIGameLessonStageProvider(
        api_key="",
        model="gpt-5-mini",
        input_token_cost_per_million_usd=0.25,
        output_token_cost_per_million_usd=2.0,
        client=client,
    )

    result = await provider.generate_section_script(
        template_payload={
            "studentAudience": "sixth grade math students",
            "sections": [{"id": "do_now", "title": "Do Now"}],
            "questions": [{"id": "do_now_1", "answer": "8 cubes"}],
            "fillTargets": [{"id": "do_now_1_answer"}],
            "guardrails": ["Use template IDs only."],
        },
        selected_instructor_id="male",
    )

    assert result.payload["promptMetadata"]["provider"] == "openai"
    assert result.payload["promptMetadata"]["inputTokens"] == 100
    assert result.config_metadata["model"] == "gpt-5-mini"
    assert [(event.unit_type, event.quantity) for event in result.usage_records] == [
        ("input_tokens", 100),
        ("output_tokens", 25),
    ]
    assert client.responses.calls[0]["text"]["format"]["name"] == "game_lesson_section_script"


@pytest.mark.asyncio
async def test_openai_game_lesson_provider_generates_speech_markup_with_usage():
    client = _FakeClient(
        """
        {
          "summary": "Speech-ready narration.",
          "markupVersion": 1,
          "sourceScriptVersion": 1,
          "sections": [
            {
              "sectionId": "do_now",
              "sourceScriptSectionId": "do_now",
              "targetDurationSeconds": 30,
              "speechText": "Count the cubes carefully. <break time=\\"0.5s\\" />",
              "approvalRequired": true
            }
          ]
        }
        """
    )
    provider = OpenAIGameLessonStageProvider(
        api_key="",
        model="gpt-5-mini",
        input_token_cost_per_million_usd=0.25,
        output_token_cost_per_million_usd=2.0,
        client=client,
    )

    result = await provider.generate_speech_markup(
        section_script_payload={
            "scriptVersion": 1,
            "sections": [{"sectionId": "do_now", "narration": "Count the cubes carefully."}],
        }
    )

    assert result.payload["sections"][0]["speechText"].startswith("Count the cubes")
    assert result.payload["promptMetadata"]["provider"] == "openai"
    assert result.usage_records[0].metadata == {"stage": "speech_markup"}
    assert client.responses.calls[0]["text"]["format"]["name"] == "game_lesson_speech_markup"
