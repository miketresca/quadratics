import httpx
import pytest

from app.providers.heygen.avatar_provider import (
    HeyGenAvatarVideoProvider,
    HeyGenProviderError,
)
from app.services.avatars.base import AvatarVideoRequest


@pytest.mark.asyncio
async def test_heygen_provider_downloads_completed_webm_video():
    create_payloads = []

    async def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST" and str(request.url) == "https://api.heygen.com/v3/videos":
            create_payloads.append(request.read())
            return httpx.Response(200, json={"data": {"video_id": "video-1"}})
        if request.method == "GET" and str(request.url) == "https://api.heygen.com/v3/videos/video-1":
            return httpx.Response(
                200,
                json={
                    "data": {
                        "status": "completed",
                        "video_url": "https://files.heygen.ai/video/video-1.webm",
                        "duration": 1.5,
                    }
                },
            )
        if request.method == "GET" and str(request.url) == "https://files.heygen.ai/video/video-1.webm":
            return httpx.Response(
                200,
                content=b"\x1a\x45\xdf\xa3webm-bytes",
                headers={"content-type": "video/webm"},
            )
        return httpx.Response(404)

    provider = HeyGenAvatarVideoProvider(
        api_key="test-key",
        poll_interval_seconds=0,
        timeout_seconds=5,
        client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )

    result = await provider.generate(
        AvatarVideoRequest(
            generation_job_id="generation-1",
            avatar_id="avatar-1",
            audio_url="https://audio.example/segment.mp3",
            avatar_model="avatar_iii",
            title="Segment 1",
        )
    )

    assert result.content_type == "video/webm"
    assert result.content.startswith(b"\x1a\x45\xdf\xa3")
    assert b'"engine":{"type":"avatar_iii"}' in create_payloads[0]
    assert result.provider_metadata["avatarModel"] == "avatar_iii"
    assert result.provider_metadata["downloadSizeBytes"] == len(result.content)


@pytest.mark.asyncio
async def test_heygen_provider_rejects_non_video_download():
    async def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST" and str(request.url) == "https://api.heygen.com/v3/videos":
            return httpx.Response(200, json={"data": {"video_id": "video-1"}})
        if request.method == "GET" and str(request.url) == "https://api.heygen.com/v3/videos/video-1":
            return httpx.Response(
                200,
                json={
                    "data": {
                        "status": "completed",
                        "video_url": "https://files.heygen.ai/video/video-1.webm",
                    }
                },
            )
        if request.method == "GET" and str(request.url) == "https://files.heygen.ai/video/video-1.webm":
            return httpx.Response(
                200,
                content=b"not a video",
                headers={"content-type": "text/plain"},
            )
        return httpx.Response(404)

    provider = HeyGenAvatarVideoProvider(
        api_key="test-key",
        poll_interval_seconds=0,
        timeout_seconds=5,
        client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )

    with pytest.raises(HeyGenProviderError, match="not a webm video"):
        await provider.generate(
            AvatarVideoRequest(
                generation_job_id="generation-1",
                avatar_id="avatar-1",
                audio_url="https://audio.example/segment.mp3",
                title="Segment 1",
            )
        )
