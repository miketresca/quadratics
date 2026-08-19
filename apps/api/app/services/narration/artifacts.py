from __future__ import annotations

import base64

from app.schemas.narration import LessonNarration, NarrationSegment
from app.services.artifacts import ArtifactLifecycleService, InMemoryArtifactRepository
from app.services.artifacts.hashing import artifact_input_hash
from app.services.artifacts.repository import ArtifactRecord, ArtifactStorageReference
from app.services.storage.media_store import MediaStore


class NarrationArtifactService:
    def __init__(
        self,
        *,
        repository: InMemoryArtifactRepository,
        media_store: MediaStore,
    ) -> None:
        self._repository = repository
        self._media_store = media_store
        self._lifecycle = ArtifactLifecycleService(repository)

    def find_reusable_narration(
        self,
        *,
        generation_job_id: str,
        script_artifact_id: str,
        speech_text: str,
        voice_id: str,
        model_id: str,
        voice_settings: dict[str, object] | None = None,
        output_format: str = "mp3",
    ) -> ArtifactRecord | None:
        request_artifact = self._repository.find_reusable(
            generation_job_id=generation_job_id,
            stage="elevenlabs_request",
            input_hash=_request_hash(
                script_artifact_id=script_artifact_id,
                speech_text=speech_text,
            ),
        )
        if request_artifact is None:
            return None
        return self._repository.find_reusable(
            generation_job_id=generation_job_id,
            stage="elevenlabs_audio",
            input_hash=_audio_hash(
                request_artifact_id=request_artifact.id,
                script_artifact_id=script_artifact_id,
                speech_text=speech_text,
                voice_id=voice_id,
                model_id=model_id,
                voice_settings=voice_settings,
                output_format=output_format,
            ),
        )

    def persist_completed_narration(
        self,
        *,
        generation_job_id: str,
        user_id: str,
        script_artifact_id: str,
        narration: LessonNarration,
        voice_id: str,
        model_id: str,
        voice_settings: dict[str, object] | None = None,
        output_format: str = "mp3",
        force: bool = False,
    ) -> tuple[ArtifactRecord, ArtifactRecord]:
        if narration.status != "completed":
            raise ValueError("only completed narration can be persisted as audio")
        if not narration.speech_text:
            raise ValueError("completed narration artifact requires speech_text")

        request_run = self._lifecycle.start_stage(
            generation_job_id=generation_job_id,
            user_id=user_id,
            stage="elevenlabs_request",
            input_payload={
                "scriptArtifactId": script_artifact_id,
                "speechText": narration.speech_text,
            },
            upstream_artifact_ids=[script_artifact_id],
            provider="openai",
            model="speech-markup",
            force=force,
        )
        request_artifact = request_run.artifact
        if request_artifact.status != "completed":
            request_artifact = self._repository.complete_attempt(
                request_artifact.id,
                payload={
                    "scriptArtifactId": script_artifact_id,
                    "speechText": narration.speech_text,
                    "segmentCount": len(narration.segments),
                },
            )

        audio_run = self._lifecycle.start_stage(
            generation_job_id=generation_job_id,
            user_id=user_id,
            stage="elevenlabs_audio",
            input_payload={
                "scriptArtifactId": script_artifact_id,
                "speechText": narration.speech_text,
                "voiceId": voice_id,
                "modelId": model_id,
                "voiceSettings": voice_settings or {},
                "outputFormat": output_format,
            },
            upstream_artifact_ids=[request_artifact.id],
            provider="elevenlabs",
            model=model_id,
            config_metadata={
                "voiceId": voice_id,
                "voiceSettings": voice_settings or {},
                "outputFormat": output_format,
            },
            force=force,
        )
        if audio_run.cache_hit:
            return request_artifact, audio_run.artifact

        storage_objects = [
            self._store_segment(
                generation_job_id=generation_job_id,
                user_id=user_id,
                artifact_id=audio_run.artifact.id,
                segment=segment,
            )
            for segment in narration.segments
        ]
        audio_artifact = self._repository.complete_attempt(
            audio_run.artifact.id,
            payload=_narration_payload(narration),
            storage_objects=storage_objects,
        )
        return request_artifact, audio_artifact

    def _store_segment(
        self,
        *,
        generation_job_id: str,
        user_id: str,
        artifact_id: str,
        segment: NarrationSegment,
    ) -> ArtifactStorageReference:
        audio_bytes = base64.b64decode(segment.audio_base64)
        reference = self._media_store.put(
            path=(
                f"{user_id}/{generation_job_id}/narration/"
                f"{artifact_id}/{segment.script_segment_id}.mp3"
            ),
            content=audio_bytes,
            content_type=segment.audio_mime_type,
            metadata={
                "scriptSegmentId": segment.script_segment_id,
                "stepId": segment.step_id,
            },
        )
        return ArtifactStorageReference(
            bucket=reference.bucket,
            path=reference.path,
            content_type=reference.content_type,
            size_bytes=reference.size_bytes,
            checksum_sha256=reference.checksum_sha256,
            duration_seconds=segment.duration_seconds,
            metadata=reference.metadata,
        )


def _request_hash(*, script_artifact_id: str, speech_text: str) -> str:
    return artifact_input_hash(
        {
            "input": {
                "scriptArtifactId": script_artifact_id,
                "speechText": speech_text,
            },
            "upstreamArtifactIds": [script_artifact_id],
            "provider": "openai",
            "model": "speech-markup",
            "config": {},
        }
    )


def _audio_hash(
    *,
    request_artifact_id: str,
    script_artifact_id: str,
    speech_text: str,
    voice_id: str,
    model_id: str,
    voice_settings: dict[str, object] | None,
    output_format: str,
) -> str:
    return artifact_input_hash(
        {
            "input": {
                "scriptArtifactId": script_artifact_id,
                "speechText": speech_text,
                "voiceId": voice_id,
                "modelId": model_id,
                "voiceSettings": voice_settings or {},
                "outputFormat": output_format,
            },
            "upstreamArtifactIds": [request_artifact_id],
            "provider": "elevenlabs",
            "model": model_id,
            "config": {
                "voiceId": voice_id,
                "voiceSettings": voice_settings or {},
                "outputFormat": output_format,
            },
        }
    )


def _narration_payload(narration: LessonNarration) -> dict[str, object]:
    payload = narration.model_dump(mode="json", by_alias=True)
    for segment in payload.get("segments", []):
        if isinstance(segment, dict):
            segment.pop("audioBase64", None)
    payload.pop("audioBase64", None)
    return payload
