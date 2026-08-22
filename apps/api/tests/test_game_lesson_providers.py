from types import SimpleNamespace

import pytest

from app.providers.elevenlabs.narration_provider import ElevenLabsProviderError
from app.services.game_lessons.providers import (
    ElevenLabsGameLessonNarrationProvider,
    GameLessonProviderRuntimeError,
    OpenAIGameLessonStageProvider,
)
from app.services.narration.base import NarrationRequest, NarrationResult
from app.services.storage.media_store import InMemoryMediaStore


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


class _FakeNarrationProvider:
    async def generate(self, request: NarrationRequest) -> NarrationResult:
        return NarrationResult(
            provider="elevenlabs",
            audio_base64="YXVkaW8=",
            audio_mime_type="audio/mpeg",
            duration_seconds=1.25,
            provider_metadata={"sectionId": request.step_id},
        )


class _FailingNarrationProvider:
    async def generate(self, request: NarrationRequest) -> NarrationResult:
        raise ElevenLabsProviderError(
            "ElevenLabs payment is required or the account has insufficient credits.",
            status_code=402,
            error_type="payment_required",
        )


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
    system_prompt = client.responses.calls[0]["input"][0]["content"]
    assert "fixed worksheet boxes" in system_prompt
    assert "For vocabulary sections" in system_prompt
    assert "sixth graders" in system_prompt
    assert result.config_metadata["stageInput"]["input"] == client.responses.calls[0]["input"]
    assert result.config_metadata["stageOutput"] == result.payload


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
    assert result.config_metadata["stageInput"]["input"] == client.responses.calls[0]["input"]
    assert result.config_metadata["stageOutput"] == result.payload


@pytest.mark.asyncio
async def test_elevenlabs_game_lesson_provider_stores_section_audio_with_usage():
    media_store = InMemoryMediaStore(bucket="generated-media")
    provider = ElevenLabsGameLessonNarrationProvider(
        provider=_FakeNarrationProvider(),
        media_store=media_store,
        voice_id_resolver=lambda _instructor_id: _async_value("voice-123"),
        model_id="eleven_multilingual_v2",
        cost_per_credit_usd=0.01,
    )

    result = await provider.generate_narration(
        user_id="user-a",
        run_id="run-a",
        selected_instructor_id="male",
        speech_markup_payload={
            "sections": [
                {
                    "sectionId": "do_now",
                    "speechText": "Count the cubes carefully.",
                }
            ]
        },
    )

    section = result.payload["sections"][0]
    assert result.payload["provider"] == "elevenlabs"
    assert section["durationSeconds"] == 1.25
    assert section["storageRef"]["path"] == "user-a/run-a/game/narration/do_now.mp3"
    assert media_store.get("user-a/run-a/game/narration/do_now.mp3") == b"audio"
    assert result.storage_refs[0]["contentType"] == "audio/mpeg"
    assert result.usage_records[0].unit_type == "credits"
    assert result.usage_records[0].quantity == len("Count the cubes carefully.")
    assert result.config_metadata["stageInput"]["sections"] == [
        {
            "modelId": "eleven_multilingual_v2",
            "sectionId": "do_now",
            "text": "Count the cubes carefully.",
            "voiceId": "voice-123",
        }
    ]
    assert result.config_metadata["stageOutput"]["sections"][0]["sectionId"] == "do_now"


@pytest.mark.asyncio
async def test_elevenlabs_game_lesson_provider_names_failed_section():
    provider = ElevenLabsGameLessonNarrationProvider(
        provider=_FailingNarrationProvider(),
        media_store=InMemoryMediaStore(bucket="generated-media"),
        voice_id_resolver=lambda _instructor_id: _async_value("voice-123"),
        model_id="eleven_multilingual_v2",
        cost_per_credit_usd=0.01,
    )

    with pytest.raises(GameLessonProviderRuntimeError) as exc_info:
        await provider.generate_narration(
            user_id="user-a",
            run_id="run-a",
            selected_instructor_id="male",
            speech_markup_payload={
                "sections": [
                    {
                        "sectionId": "do_now",
                        "speechText": "Count the cubes carefully.",
                    }
                ]
            },
        )

    assert exc_info.value.status_code == 402
    assert exc_info.value.provider == "elevenlabs"
    assert exc_info.value.stage == "narration"
    assert "do_now" in str(exc_info.value)
    assert "insufficient credits" in str(exc_info.value)


async def _async_value(value: str) -> str:
    return value
