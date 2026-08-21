from __future__ import annotations

import json
import base64
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Protocol

from app.services.narration.base import NarrationProvider, NarrationRequest
from app.services.storage.media_store import MediaStore


class GameLessonProviderConfigurationError(RuntimeError):
    pass


@dataclass(frozen=True)
class GameLessonUsageRecord:
    provider: str
    model: str | None
    unit_type: str
    quantity: float
    unit_cost_usd: float
    metadata: dict[str, object] = field(default_factory=dict)


@dataclass(frozen=True)
class GameLessonProviderResult:
    payload: dict[str, Any]
    config_metadata: dict[str, Any]
    usage_records: list[GameLessonUsageRecord] = field(default_factory=list)
    storage_refs: list[dict[str, Any]] = field(default_factory=list)


class GameLessonStageProvider(Protocol):
    async def generate_section_script(
        self,
        *,
        template_payload: dict[str, Any],
        selected_instructor_id: str | None,
    ) -> GameLessonProviderResult: ...

    async def generate_speech_markup(
        self,
        *,
        section_script_payload: dict[str, Any],
    ) -> GameLessonProviderResult: ...


class GameLessonNarrationStageProvider(Protocol):
    async def generate_narration(
        self,
        *,
        user_id: str,
        run_id: str,
        selected_instructor_id: str | None,
        speech_markup_payload: dict[str, Any],
    ) -> GameLessonProviderResult: ...


SECTION_SCRIPT_SCHEMA: dict[str, Any] = {
    "name": "game_lesson_section_script",
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "summary",
            "scriptVersion",
            "targetTotalSeconds",
            "audience",
            "sourceTemplateId",
            "sections",
        ],
        "properties": {
            "summary": {"type": "string", "minLength": 1},
            "scriptVersion": {"type": "integer", "minimum": 1},
            "targetTotalSeconds": {"type": "number", "minimum": 1},
            "audience": {"type": "string", "minLength": 1},
            "sourceTemplateId": {"type": "string", "minLength": 1},
            "sections": {
                "type": "array",
                "minItems": 1,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": [
                        "sectionId",
                        "title",
                        "targetDurationSeconds",
                        "regionId",
                        "questionIds",
                        "fillTargetIds",
                        "narration",
                        "approvalRequired",
                    ],
                    "properties": {
                        "sectionId": {"type": "string", "minLength": 1},
                        "title": {"type": "string", "minLength": 1},
                        "targetDurationSeconds": {"type": "number", "minimum": 1},
                        "regionId": {"type": "string", "minLength": 1},
                        "questionIds": {
                            "type": "array",
                            "items": {"type": "string", "minLength": 1},
                        },
                        "fillTargetIds": {
                            "type": "array",
                            "items": {"type": "string", "minLength": 1},
                        },
                        "narration": {"type": "string", "minLength": 1},
                        "approvalRequired": {"type": "boolean"},
                    },
                },
            },
        },
    },
    "strict": True,
}


SPEECH_MARKUP_SCHEMA: dict[str, Any] = {
    "name": "game_lesson_speech_markup",
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "summary",
            "markupVersion",
            "sourceScriptVersion",
            "sections",
        ],
        "properties": {
            "summary": {"type": "string", "minLength": 1},
            "markupVersion": {"type": "integer", "minimum": 1},
            "sourceScriptVersion": {"type": "integer", "minimum": 1},
            "sections": {
                "type": "array",
                "minItems": 1,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": [
                        "sectionId",
                        "sourceScriptSectionId",
                        "targetDurationSeconds",
                        "speechText",
                        "approvalRequired",
                    ],
                    "properties": {
                        "sectionId": {"type": "string", "minLength": 1},
                        "sourceScriptSectionId": {"type": "string", "minLength": 1},
                        "targetDurationSeconds": {"type": "number", "minimum": 1},
                        "speechText": {"type": "string", "minLength": 1},
                        "approvalRequired": {"type": "boolean"},
                    },
                },
            },
        },
    },
    "strict": True,
}


class OpenAIGameLessonStageProvider:
    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        input_token_cost_per_million_usd: float,
        output_token_cost_per_million_usd: float,
        client: Any | None = None,
    ) -> None:
        if not api_key and client is None:
            raise GameLessonProviderConfigurationError("OPENAI_API_KEY is required for game lesson generation")
        self.model = model
        self._input_unit_cost = input_token_cost_per_million_usd / 1_000_000
        self._output_unit_cost = output_token_cost_per_million_usd / 1_000_000
        if client is not None:
            self.client = client
            return

        try:
            from openai import AsyncOpenAI
        except ImportError as error:
            raise GameLessonProviderConfigurationError(
                "The openai package is required for game lesson generation"
            ) from error

        self.client = AsyncOpenAI(api_key=api_key)

    async def generate_section_script(
        self,
        *,
        template_payload: dict[str, Any],
        selected_instructor_id: str | None,
    ) -> GameLessonProviderResult:
        response = await self.client.responses.create(
            model=self.model,
            input=[
                {
                    "role": "system",
                    "content": (
                        "Write concise narration for an interactive sixth-grade worksheet lesson. "
                        "Use only the supplied worksheet template, regions, questions, answers, and "
                        "fill targets as source material. Do not invent new math, new answers, new "
                        "sections, or new worksheet IDs. Split narration by the existing major "
                        "sections. The complete lesson should target about three minutes or less."
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "selectedInstructorId": selected_instructor_id,
                            "studentAudience": template_payload.get("studentAudience"),
                            "sections": template_payload.get("sections", []),
                            "questions": template_payload.get("questions", []),
                            "fillTargets": template_payload.get("fillTargets", []),
                            "guardrails": template_payload.get("guardrails", []),
                        }
                    ),
                },
            ],
            text={"format": {"type": "json_schema", **SECTION_SCRIPT_SCHEMA}},
        )
        payload = json.loads(_response_text(response))
        usage = _response_usage(response)
        payload["promptMetadata"] = _prompt_metadata(
            provider="openai",
            model=self.model,
            usage=usage,
            prompt_source="apps/api/app/services/game_lessons/providers.py:section_script",
        )
        return GameLessonProviderResult(
            payload=payload,
            config_metadata=_config_metadata("openai", self.model, usage),
            usage_records=self._usage_records("section_script", usage),
        )

    async def generate_speech_markup(
        self,
        *,
        section_script_payload: dict[str, Any],
    ) -> GameLessonProviderResult:
        response = await self.client.responses.create(
            model=self.model,
            input=[
                {
                    "role": "system",
                    "content": (
                        "Convert interactive worksheet narration into ElevenLabs-friendly speech. "
                        "Keep the same section IDs, order, meaning, and approximate duration. Write "
                        "conversational spoken text, avoid raw math symbols when words are clearer, "
                        "and use SSML break tags sparingly. Do not add examples or new answers."
                    ),
                },
                {"role": "user", "content": json.dumps(section_script_payload)},
            ],
            text={"format": {"type": "json_schema", **SPEECH_MARKUP_SCHEMA}},
        )
        payload = json.loads(_response_text(response))
        usage = _response_usage(response)
        payload["promptMetadata"] = _prompt_metadata(
            provider="openai",
            model=self.model,
            usage=usage,
            prompt_source="apps/api/app/services/game_lessons/providers.py:speech_markup",
        )
        return GameLessonProviderResult(
            payload=payload,
            config_metadata=_config_metadata("openai", self.model, usage),
            usage_records=self._usage_records("speech_markup", usage),
        )

    def _usage_records(self, stage: str, usage: dict[str, int]) -> list[GameLessonUsageRecord]:
        records: list[GameLessonUsageRecord] = []
        input_tokens = usage.get("inputTokens")
        if input_tokens is not None:
            records.append(
                GameLessonUsageRecord(
                    provider="openai",
                    model=self.model,
                    unit_type="input_tokens",
                    quantity=input_tokens,
                    unit_cost_usd=self._input_unit_cost,
                    metadata={"stage": stage},
                )
            )
        output_tokens = usage.get("outputTokens")
        if output_tokens is not None:
            records.append(
                GameLessonUsageRecord(
                    provider="openai",
                    model=self.model,
                    unit_type="output_tokens",
                    quantity=output_tokens,
                    unit_cost_usd=self._output_unit_cost,
                    metadata={"stage": stage},
                )
            )
        return records


class ElevenLabsGameLessonNarrationProvider:
    def __init__(
        self,
        *,
        provider: NarrationProvider,
        media_store: MediaStore,
        voice_id_resolver: Callable[[str | None], Awaitable[str]],
        model_id: str,
        cost_per_credit_usd: float,
    ) -> None:
        self._provider = provider
        self._media_store = media_store
        self._voice_id_resolver = voice_id_resolver
        self._model_id = model_id
        self._cost_per_credit_usd = cost_per_credit_usd

    async def generate_narration(
        self,
        *,
        user_id: str,
        run_id: str,
        selected_instructor_id: str | None,
        speech_markup_payload: dict[str, Any],
    ) -> GameLessonProviderResult:
        voice_id = await self._voice_id_resolver(selected_instructor_id)
        if not voice_id:
            raise GameLessonProviderConfigurationError("Selected instructor does not have an ElevenLabs voice ID")

        sections: list[dict[str, Any]] = []
        storage_refs: list[dict[str, Any]] = []
        usage_records: list[GameLessonUsageRecord] = []
        elapsed_seconds = 0.0
        for index, section in enumerate(speech_markup_payload.get("sections", []), start=1):
            if not isinstance(section, dict):
                continue
            section_id = str(section.get("sectionId", f"section_{index}"))
            speech_text = str(section.get("speechText", "")).strip()
            if not speech_text:
                continue
            result = await self._provider.generate(
                NarrationRequest(
                    step_id=section_id,
                    text=speech_text,
                    voice_id=voice_id,
                )
            )
            audio_bytes = base64.b64decode(result.audio_base64)
            reference = self._media_store.put(
                path=f"{user_id}/{run_id}/game/narration/{section_id}.mp3",
                content=audio_bytes,
                content_type=result.audio_mime_type,
                metadata={"sectionId": section_id, "voiceId": voice_id},
            )
            storage_ref = {
                "bucket": reference.bucket,
                "path": reference.path,
                "signedUrl": reference.signed_url,
                "contentType": reference.content_type,
                "sizeBytes": reference.size_bytes,
                "checksumSha256": reference.checksum_sha256,
                "durationSeconds": result.duration_seconds,
                "metadata": reference.metadata,
            }
            storage_refs.append(storage_ref)
            duration_seconds = round(result.duration_seconds or _estimated_speech_duration_seconds(speech_text), 2)
            sections.append(
                {
                    "sectionId": section_id,
                    "audioMode": "elevenlabs",
                    "audioUrl": reference.signed_url,
                    "storageRef": storage_ref,
                    "speechText": speech_text,
                    "durationSeconds": duration_seconds,
                    "startSeconds": round(elapsed_seconds, 2),
                    "endSeconds": round(elapsed_seconds + duration_seconds, 2),
                    "alignment": _alignment_payload(result.normalized_alignment or result.alignment),
                    "providerMetadata": result.provider_metadata or {},
                }
            )
            elapsed_seconds += duration_seconds
            usage_records.append(
                GameLessonUsageRecord(
                    provider="elevenlabs",
                    model=self._model_id,
                    unit_type="credits",
                    quantity=len(speech_text),
                    unit_cost_usd=self._cost_per_credit_usd,
                    metadata={"sectionId": section_id},
                )
            )

        return GameLessonProviderResult(
            payload={
                "summary": "ElevenLabs narration audio generated section by section for worksheet playback.",
                "narrationVersion": 1,
                "provider": "elevenlabs",
                "model": self._model_id,
                "selectedInstructorId": selected_instructor_id,
                "voiceId": voice_id,
                "durationSeconds": round(elapsed_seconds, 2),
                "sections": sections,
            },
            config_metadata={
                "provider": "elevenlabs",
                "model": self._model_id,
                "source": "game_lesson_narration_provider",
                "voiceId": voice_id,
            },
            usage_records=usage_records,
            storage_refs=storage_refs,
        )


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

    raise ValueError("OpenAI response did not contain game lesson JSON text")


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


def _prompt_metadata(
    *,
    provider: str,
    model: str,
    usage: dict[str, int],
    prompt_source: str,
) -> dict[str, Any]:
    return {
        "provider": provider,
        "model": model,
        "promptSource": prompt_source,
        **usage,
    }


def _config_metadata(provider: str, model: str, usage: dict[str, int]) -> dict[str, Any]:
    return {
        "provider": provider,
        "model": model,
        "source": "game_lesson_stage_provider",
        "usage": usage,
    }


def _estimated_speech_duration_seconds(speech_text: str) -> float:
    stripped_text = speech_text.replace('<break time="0.5s" />', " ")
    word_count = len([word for word in stripped_text.split() if word.strip()])
    break_count = speech_text.count('<break time="0.5s" />')
    return round(max(word_count / 2.65 + break_count * 0.5, 4.0), 2)


def _alignment_payload(alignment: Any | None) -> dict[str, Any] | None:
    if alignment is None:
        return None
    if hasattr(alignment, "model_dump"):
        return alignment.model_dump(mode="json", by_alias=True)
    return None
