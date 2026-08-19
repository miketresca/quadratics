from typing import Any

import httpx

from app.schemas.narration import AudioAlignment
from app.services.narration.base import NarrationProvider, NarrationRequest, NarrationResult


class NarrationProviderConfigurationError(RuntimeError):
    pass


class ElevenLabsProviderError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        status_code: int,
        error_type: str | None = None,
        error_code: str | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.error_type = error_type
        self.error_code = error_code


class ElevenLabsNarrationProvider(NarrationProvider):
    def __init__(
        self,
        *,
        api_key: str,
        model_id: str,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        if not api_key and client is None:
            raise NarrationProviderConfigurationError(
                "ELEVENLABS_API_KEY is required for audio generation"
            )
        self.api_key = api_key
        self.model_id = model_id
        self.client = client

    async def generate(self, request: NarrationRequest) -> NarrationResult:
        if not request.voice_id:
            raise ValueError("voice_id is required for ElevenLabs narration")

        payload = {
            "text": request.text,
            "model_id": self.model_id,
        }
        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
        }
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{request.voice_id}/with-timestamps"
        params = {"output_format": "mp3_44100_128"}

        try:
            if self.client is not None:
                response = await self.client.post(
                    url,
                    params=params,
                    headers=headers,
                    json=payload,
                    timeout=120,
                )
            else:
                async with httpx.AsyncClient(timeout=120) as client:
                    response = await client.post(
                        url,
                        params=params,
                        headers=headers,
                        json=payload,
                    )
        except httpx.HTTPError as exc:
            raise ElevenLabsProviderError(
                f"ElevenLabs audio generation request failed: {exc}",
                status_code=0,
            ) from exc

        if not response.is_success:
            raise _provider_error_from_response(response)

        body = response.json()
        audio_base64 = body.get("audio_base64")
        if not isinstance(audio_base64, str) or not audio_base64:
            raise RuntimeError("ElevenLabs response did not include audio_base64")

        normalized_alignment = _alignment_from_response(body.get("normalized_alignment"))
        alignment = _alignment_from_response(body.get("alignment"))
        duration_seconds = _duration_from_alignment(
            normalized_alignment
        ) or _duration_from_alignment(alignment)

        return NarrationResult(
            provider="elevenlabs",
            audio_base64=audio_base64,
            audio_mime_type="audio/mpeg",
            duration_seconds=duration_seconds,
            alignment=alignment,
            normalized_alignment=normalized_alignment,
            provider_metadata={"model": self.model_id},
        )


def _alignment_from_response(value: Any) -> AudioAlignment | None:
    if not isinstance(value, dict):
        return None
    return AudioAlignment(
        characters=value.get("characters") if isinstance(value.get("characters"), list) else [],
        character_start_times_seconds=value.get("character_start_times_seconds")
        if isinstance(value.get("character_start_times_seconds"), list)
        else [],
        character_end_times_seconds=value.get("character_end_times_seconds")
        if isinstance(value.get("character_end_times_seconds"), list)
        else [],
    )


def _duration_from_alignment(alignment: AudioAlignment | None) -> float | None:
    if alignment is None or not alignment.character_end_times_seconds:
        return None
    return max(alignment.character_end_times_seconds)


def _provider_error_from_response(response: httpx.Response) -> ElevenLabsProviderError:
    error_type: str | None = None
    error_code: str | None = None
    detail_message: str | None = None

    try:
        body = response.json()
    except ValueError:
        body = None

    if isinstance(body, dict):
        detail = body.get("detail")
        if isinstance(detail, dict):
            raw_type = detail.get("type")
            raw_code = detail.get("code") or detail.get("status")
            raw_message = detail.get("message")
            error_type = raw_type if isinstance(raw_type, str) else None
            error_code = raw_code if isinstance(raw_code, str) else None
            detail_message = raw_message if isinstance(raw_message, str) else None
        elif isinstance(detail, str):
            detail_message = detail

    if response.status_code == 402 or error_type == "payment_required":
        message = "ElevenLabs payment is required or the account has insufficient credits"
        if detail_message:
            message = f"{message}: {detail_message}"
        else:
            message = f"{message}."
    elif detail_message:
        message = f"ElevenLabs audio generation failed: {detail_message}"
    else:
        message = f"ElevenLabs audio generation failed: {response.status_code}"

    return ElevenLabsProviderError(
        message,
        status_code=response.status_code,
        error_type=error_type,
        error_code=error_code,
    )
