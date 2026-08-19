import httpx
import pytest

from app.providers.elevenlabs.narration_provider import (
    ElevenLabsNarrationProvider,
    ElevenLabsProviderError,
)
from app.services.narration.base import NarrationRequest


@pytest.mark.asyncio
async def test_elevenlabs_payment_required_error_uses_response_detail():
    transport = httpx.MockTransport(
        lambda request: httpx.Response(
            402,
            json={
                "detail": {
                    "type": "payment_required",
                    "code": "insufficient_credits",
                    "message": "Your account does not have enough credits for this operation.",
                }
            },
        )
    )
    async with httpx.AsyncClient(transport=transport) as client:
        provider = ElevenLabsNarrationProvider(
            api_key="test-key",
            model_id="eleven_multilingual_v2",
            client=client,
        )

        with pytest.raises(ElevenLabsProviderError) as exc_info:
            await provider.generate(
                NarrationRequest(
                    step_id="teacher_script",
                    text="First factor the quadratic.",
                    voice_id="voice-id",
                )
            )

    assert str(exc_info.value) == (
        "ElevenLabs payment is required or the account has insufficient credits: "
        "Your account does not have enough credits for this operation."
    )
    assert exc_info.value.status_code == 402
    assert exc_info.value.error_type == "payment_required"
    assert exc_info.value.error_code == "insufficient_credits"


@pytest.mark.asyncio
async def test_elevenlabs_transport_error_becomes_provider_error():
    async def timeout(_request):
        raise httpx.ConnectTimeout("connection timed out")

    async with httpx.AsyncClient(transport=httpx.MockTransport(timeout)) as client:
        provider = ElevenLabsNarrationProvider(
            api_key="test-key",
            model_id="eleven_multilingual_v2",
            client=client,
        )

        with pytest.raises(ElevenLabsProviderError) as exc_info:
            await provider.generate(
                NarrationRequest(
                    step_id="teacher_script",
                    text="First factor the quadratic.",
                    voice_id="voice-id",
                )
            )

    assert str(exc_info.value) == (
        "ElevenLabs audio generation request failed: connection timed out"
    )
    assert exc_info.value.status_code == 0
