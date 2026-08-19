from app.schemas.narration import AudioAlignment, LessonNarration, NarrationSegment
from app.services.artifacts import InMemoryArtifactRepository
from app.services.narration.artifacts import NarrationArtifactService
from app.services.storage.media_store import InMemoryMediaStore


def completed_narration() -> LessonNarration:
    return LessonNarration(
        status="completed",
        provider="elevenlabs",
        voice_id="voice-1",
        model_id="eleven_multilingual_v2",
        duration_seconds=1.4,
        speech_text="First factor. Then solve.",
        segments=[
            NarrationSegment(
                script_segment_id="script_factor",
                step_id="factor",
                title="Factor",
                provider="elevenlabs",
                voice_id="voice-1",
                model_id="eleven_multilingual_v2",
                audio_mime_type="audio/mpeg",
                audio_base64="ZmFrZS1tcDM=",
                duration_seconds=1.4,
                speech_text="First factor.",
                normalized_alignment=AudioAlignment(
                    characters=["F", "i"],
                    character_start_times_seconds=[0, 0.2],
                    character_end_times_seconds=[0.2, 0.4],
                ),
            )
        ],
    )


def test_completed_narration_persists_request_and_audio_artifacts_with_storage_refs():
    repository = InMemoryArtifactRepository()
    media = InMemoryMediaStore(bucket="generated-media")
    service = NarrationArtifactService(repository=repository, media_store=media)

    request, audio = service.persist_completed_narration(
        generation_job_id="generation-1",
        user_id="user-1",
        script_artifact_id="script-artifact-1",
        narration=completed_narration(),
        voice_id="voice-1",
        model_id="eleven_multilingual_v2",
        voice_settings={"stability": 0.5},
    )

    assert request.status == "completed"
    assert request.stage == "elevenlabs_request"
    assert request.payload["speechText"] == "First factor. Then solve."
    assert audio.status == "completed"
    assert audio.stage == "elevenlabs_audio"
    assert audio.upstream_artifact_ids == [request.id]
    assert audio.storage_objects[0].bucket == "generated-media"
    assert audio.storage_objects[0].path.startswith("user-1/generation-1/narration/")
    assert audio.payload["segments"][0]["normalizedAlignment"]["characters"] == ["F", "i"]


def test_identical_narration_inputs_can_be_reused_before_provider_call():
    repository = InMemoryArtifactRepository()
    media = InMemoryMediaStore(bucket="generated-media")
    service = NarrationArtifactService(repository=repository, media_store=media)
    service.persist_completed_narration(
        generation_job_id="generation-1",
        user_id="user-1",
        script_artifact_id="script-artifact-1",
        narration=completed_narration(),
        voice_id="voice-1",
        model_id="eleven_multilingual_v2",
        voice_settings={"stability": 0.5},
    )

    reusable = service.find_reusable_narration(
        generation_job_id="generation-1",
        script_artifact_id="script-artifact-1",
        speech_text="First factor. Then solve.",
        voice_id="voice-1",
        model_id="eleven_multilingual_v2",
        voice_settings={"stability": 0.5},
    )

    assert reusable is not None
    assert reusable.stage == "elevenlabs_audio"


def test_changed_voice_does_not_reuse_narration_artifact():
    repository = InMemoryArtifactRepository()
    media = InMemoryMediaStore(bucket="generated-media")
    service = NarrationArtifactService(repository=repository, media_store=media)
    service.persist_completed_narration(
        generation_job_id="generation-1",
        user_id="user-1",
        script_artifact_id="script-artifact-1",
        narration=completed_narration(),
        voice_id="voice-1",
        model_id="eleven_multilingual_v2",
        voice_settings={"stability": 0.5},
    )

    reusable = service.find_reusable_narration(
        generation_job_id="generation-1",
        script_artifact_id="script-artifact-1",
        speech_text="First factor. Then solve.",
        voice_id="voice-2",
        model_id="eleven_multilingual_v2",
        voice_settings={"stability": 0.5},
    )

    assert reusable is None
