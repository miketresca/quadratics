import asyncio

import httpx

from app.services.avatars.base import AvatarVideoProvider, AvatarVideoRequest, AvatarVideoResult


class HeyGenProviderConfigurationError(RuntimeError):
    pass


class HeyGenProviderError(RuntimeError):
    pass


class HeyGenAvatarVideoProvider(AvatarVideoProvider):
    def __init__(
        self,
        *,
        api_key: str,
        poll_interval_seconds: float,
        timeout_seconds: float,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        if not api_key and client is None:
            raise HeyGenProviderConfigurationError("HeyGen API key is required")
        self._api_key = api_key
        self._poll_interval_seconds = poll_interval_seconds
        self._timeout_seconds = timeout_seconds
        self._client = client

    async def generate(self, request: AvatarVideoRequest) -> AvatarVideoResult:
        headers = {
            "x-api-key": self._api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "type": "avatar",
            "avatar_id": request.avatar_id,
            "title": request.title,
            "resolution": "720p",
            "aspect_ratio": "16:9",
            "audio_url": request.audio_url,
            "output_format": request.output_format,
            "engine": {"type": "avatar_iv"},
        }
        if request.output_format != "webm":
            payload["remove_background"] = True

        async with _client_context(self._client, timeout=self._timeout_seconds) as client:
            create_response = await client.post(
                "https://api.heygen.com/v3/videos",
                headers=headers,
                json=payload,
            )
            _raise_for_heygen_error(create_response, action="create video")
            create_data = create_response.json().get("data")
            if not isinstance(create_data, dict) or not isinstance(
                create_data.get("video_id"),
                str,
            ):
                raise HeyGenProviderError("HeyGen did not return a video_id")
            video_id = create_data["video_id"]
            detail = await self._poll_until_complete(client, headers=headers, video_id=video_id)
            video_url = detail.get("video_url")
            if not isinstance(video_url, str) or not video_url:
                raise HeyGenProviderError("HeyGen completed without a video_url")
            download_response = await client.get(video_url)
            _raise_for_heygen_error(download_response, action="download video")

        return AvatarVideoResult(
            content=download_response.content,
            content_type=_content_type(download_response, request.output_format),
            duration_seconds=float(detail.get("duration") or 0),
            provider_video_id=video_id,
            output_format=request.output_format,
            provider_metadata={
                "status": detail.get("status"),
                "videoPageUrl": detail.get("video_page_url"),
                "thumbnailUrl": detail.get("thumbnail_url"),
            },
        )

    async def _poll_until_complete(
        self,
        client: httpx.AsyncClient,
        *,
        headers: dict[str, str],
        video_id: str,
    ) -> dict[str, object]:
        deadline = asyncio.get_running_loop().time() + self._timeout_seconds
        while True:
            response = await client.get(
                f"https://api.heygen.com/v3/videos/{video_id}",
                headers=headers,
            )
            _raise_for_heygen_error(response, action="get video")
            data = response.json().get("data")
            if not isinstance(data, dict):
                raise HeyGenProviderError("HeyGen video status response was malformed")
            status = data.get("status")
            if status == "completed":
                return data
            if status == "failed":
                failure = (
                    data.get("failure_message")
                    or data.get("failure_code")
                    or "unknown failure"
                )
                raise HeyGenProviderError(f"HeyGen avatar generation failed: {failure}")
            if asyncio.get_running_loop().time() >= deadline:
                raise HeyGenProviderError("HeyGen avatar generation timed out")
            await asyncio.sleep(self._poll_interval_seconds)


def _raise_for_heygen_error(response: httpx.Response, *, action: str) -> None:
    if response.is_success:
        return
    detail = response.text.strip()
    if detail:
        raise HeyGenProviderError(f"HeyGen {action} failed: {response.status_code}: {detail}")
    raise HeyGenProviderError(f"HeyGen {action} failed: {response.status_code}")


def _content_type(response: httpx.Response, output_format: str) -> str:
    content_type = response.headers.get("content-type")
    if content_type:
        return content_type.split(";")[0]
    return "video/webm" if output_format == "webm" else "video/mp4"


class _client_context:
    def __init__(self, client: httpx.AsyncClient | None, *, timeout: float) -> None:
        self._client = client
        self._timeout = timeout
        self._created: httpx.AsyncClient | None = None

    async def __aenter__(self) -> httpx.AsyncClient:
        if self._client is not None:
            return self._client
        self._created = httpx.AsyncClient(timeout=self._timeout)
        return self._created

    async def __aexit__(self, *_exc: object) -> None:
        if self._created is not None:
            await self._created.aclose()
