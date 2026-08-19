from app.services.artifacts.lifecycle import ArtifactLifecycleService
from app.services.artifacts.repository import InMemoryArtifactRepository


def complete_current(repository, *, generation_job_id, user_id, stage, input_hash, upstream_ids=()):
    artifact = repository.create_attempt(
        generation_job_id=generation_job_id,
        user_id=user_id,
        stage=stage,
        input_hash=input_hash,
        upstream_artifact_ids=list(upstream_ids),
    )
    return repository.complete_attempt(artifact.id)


def test_normal_rerun_reuses_identical_completed_artifact():
    repository = InMemoryArtifactRepository()
    lifecycle = ArtifactLifecycleService(repository)
    first = lifecycle.start_stage(
        generation_job_id="generation-1",
        user_id="user-1",
        stage="elevenlabs_audio",
        input_payload={"speechText": "hello", "voice": "voice-1"},
    )
    repository.complete_attempt(first.artifact.id)

    second = lifecycle.start_stage(
        generation_job_id="generation-1",
        user_id="user-1",
        stage="elevenlabs_audio",
        input_payload={"voice": "voice-1", "speechText": "hello"},
    )

    assert second.cache_hit is True
    assert second.artifact.id == first.artifact.id


def test_force_regenerate_creates_new_version_for_identical_inputs():
    repository = InMemoryArtifactRepository()
    lifecycle = ArtifactLifecycleService(repository)
    first = lifecycle.start_stage(
        generation_job_id="generation-1",
        user_id="user-1",
        stage="elevenlabs_audio",
        input_payload={"speechText": "hello", "voice": "voice-1"},
    )
    repository.complete_attempt(first.artifact.id)

    second = lifecycle.start_stage(
        generation_job_id="generation-1",
        user_id="user-1",
        stage="elevenlabs_audio",
        input_payload={"speechText": "hello", "voice": "voice-1"},
        force=True,
    )

    assert second.cache_hit is False
    assert second.artifact.id != first.artifact.id
    assert second.artifact.version == 2


def test_regenerating_teacher_script_marks_all_current_descendants_stale():
    repository = InMemoryArtifactRepository()
    lifecycle = ArtifactLifecycleService(repository)
    script = complete_current(
        repository,
        generation_job_id="generation-1",
        user_id="user-1",
        stage="teacher_script",
        input_hash="sha256:script-v1",
    )
    request = complete_current(
        repository,
        generation_job_id="generation-1",
        user_id="user-1",
        stage="elevenlabs_request",
        input_hash="sha256:request-v1",
        upstream_ids=[script.id],
    )
    audio = complete_current(
        repository,
        generation_job_id="generation-1",
        user_id="user-1",
        stage="elevenlabs_audio",
        input_hash="sha256:audio-v1",
        upstream_ids=[request.id],
    )
    plan = complete_current(
        repository,
        generation_job_id="generation-1",
        user_id="user-1",
        stage="animation_plan",
        input_hash="sha256:plan-v1",
        upstream_ids=[audio.id],
    )
    timeline = complete_current(
        repository,
        generation_job_id="generation-1",
        user_id="user-1",
        stage="resolved_timeline",
        input_hash="sha256:timeline-v1",
        upstream_ids=[plan.id],
    )
    render = complete_current(
        repository,
        generation_job_id="generation-1",
        user_id="user-1",
        stage="motion_canvas_render",
        input_hash="sha256:render-v1",
        upstream_ids=[timeline.id],
    )
    base_video = complete_current(
        repository,
        generation_job_id="generation-1",
        user_id="user-1",
        stage="base_video",
        input_hash="sha256:base-v1",
        upstream_ids=[render.id],
    )

    new_script = lifecycle.start_stage(
        generation_job_id="generation-1",
        user_id="user-1",
        stage="teacher_script",
        input_payload={"lessonArtifactId": "lesson-1", "promptVersion": "v2"},
        force=True,
    )
    repository.complete_attempt(new_script.artifact.id)

    assert repository.get(request.id).status == "stale"
    assert repository.get(audio.id).status == "stale"
    assert repository.get(plan.id).status == "stale"
    assert repository.get(timeline.id).status == "stale"
    assert repository.get(render.id).status == "stale"
    assert repository.get(base_video.id).status == "stale"


def test_regenerating_narration_marks_animation_and_render_descendants_stale():
    repository = InMemoryArtifactRepository()
    lifecycle = ArtifactLifecycleService(repository)
    audio = complete_current(
        repository,
        generation_job_id="generation-1",
        user_id="user-1",
        stage="elevenlabs_audio",
        input_hash="sha256:audio-v1",
    )
    plan = complete_current(
        repository,
        generation_job_id="generation-1",
        user_id="user-1",
        stage="animation_plan",
        input_hash="sha256:plan-v1",
        upstream_ids=[audio.id],
    )
    timeline = complete_current(
        repository,
        generation_job_id="generation-1",
        user_id="user-1",
        stage="resolved_timeline",
        input_hash="sha256:timeline-v1",
        upstream_ids=[plan.id],
    )
    render = complete_current(
        repository,
        generation_job_id="generation-1",
        user_id="user-1",
        stage="motion_canvas_render",
        input_hash="sha256:render-v1",
        upstream_ids=[timeline.id],
    )

    new_audio = lifecycle.start_stage(
        generation_job_id="generation-1",
        user_id="user-1",
        stage="elevenlabs_audio",
        input_payload={"speechText": "updated", "voice": "voice-1"},
        force=True,
    )
    repository.complete_attempt(new_audio.artifact.id)

    assert repository.get(plan.id).status == "stale"
    assert repository.get(timeline.id).status == "stale"
    assert repository.get(render.id).status == "stale"
