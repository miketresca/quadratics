from app.services.avatars.base import AvatarVideoProvider, AvatarVideoRequest, AvatarVideoResult


class DevelopmentAvatarVideoProvider(AvatarVideoProvider):
    async def generate(self, request: AvatarVideoRequest) -> AvatarVideoResult:
        return AvatarVideoResult(
            content=(
                f"development avatar video for {request.generation_job_id} "
                f"avatar {request.avatar_id}"
            ).encode(),
            content_type="video/webm" if request.output_format == "webm" else "video/mp4",
            duration_seconds=1.2,
            provider_video_id="development-heygen-video",
            output_format=request.output_format,
            provider_metadata={
                "provider": "development",
                "audioUrlPresent": bool(request.audio_url),
                "scriptSegmentId": request.script_segment_id,
            },
        )
