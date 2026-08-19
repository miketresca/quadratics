from datetime import UTC, datetime
from uuid import UUID

import pytest
from pydantic import ValidationError

from app.schemas.artifact import (
    ArtifactStorageObject,
    GenerationArtifact,
    GenerationArtifactDependency,
)

USER_ID = UUID("11111111-1111-1111-1111-111111111111")
GENERATION_ID = UUID("22222222-2222-2222-2222-222222222222")
ARTIFACT_ID = UUID("33333333-3333-3333-3333-333333333333")
UPSTREAM_ID = UUID("44444444-4444-4444-4444-444444444444")


def artifact_kwargs(**overrides):
    values = {
        "id": ARTIFACT_ID,
        "generation_job_id": GENERATION_ID,
        "user_id": USER_ID,
        "stage": "elevenlabs_audio",
        "version": 1,
        "status": "completed",
        "input_hash": "sha256:audio-input",
        "upstream_artifact_ids": [UPSTREAM_ID],
        "provider": "elevenlabs",
        "model": "eleven_multilingual_v2",
        "config_metadata": {"voice_id": "voice-123"},
        "payload": {"duration_seconds": 4.2},
        "storage_objects": [
            ArtifactStorageObject(
                bucket="generated-media",
                path=f"{USER_ID}/{GENERATION_ID}/narration/{ARTIFACT_ID}.mp3",
                content_type="audio/mpeg",
                size_bytes=1024,
                checksum_sha256="abc123",
                duration_seconds=4.2,
            )
        ],
        "is_current": True,
        "cache_hit": False,
        "created_at": datetime(2026, 8, 18, tzinfo=UTC),
        "completed_at": datetime(2026, 8, 18, 0, 0, 1, tzinfo=UTC),
    }
    values.update(overrides)
    return values


def test_completed_media_artifact_accepts_storage_metadata():
    artifact = GenerationArtifact(**artifact_kwargs())

    assert artifact.status == "completed"
    assert artifact.storage_objects[0].bucket == "generated-media"
    assert artifact.storage_objects[0].path.endswith(f"{ARTIFACT_ID}.mp3")


def test_stale_artifact_requires_reason():
    with pytest.raises(ValidationError, match="stale_reason"):
        GenerationArtifact(
            **artifact_kwargs(status="stale", completed_at=None, stale_reason=None)
        )


def test_non_stale_artifact_rejects_stale_reason():
    with pytest.raises(ValidationError, match="only stale"):
        GenerationArtifact(**artifact_kwargs(stale_reason="narration changed"))


def test_failed_artifact_accepts_error_without_media_output():
    artifact = GenerationArtifact(
        **artifact_kwargs(
            status="failed",
            completed_at=None,
            storage_objects=[],
            error_code="provider_error",
            error_message="provider failed",
        )
    )

    assert artifact.status == "failed"
    assert artifact.error_code == "provider_error"


def test_completed_artifact_requires_completed_at():
    with pytest.raises(ValidationError, match="completed_at"):
        GenerationArtifact(**artifact_kwargs(completed_at=None))


def test_dependency_rejects_self_reference():
    with pytest.raises(ValidationError, match="cannot reference itself"):
        GenerationArtifactDependency(
            generation_job_id=GENERATION_ID,
            upstream_artifact_id=ARTIFACT_ID,
            downstream_artifact_id=ARTIFACT_ID,
            created_at=datetime(2026, 8, 18, tzinfo=UTC),
        )
