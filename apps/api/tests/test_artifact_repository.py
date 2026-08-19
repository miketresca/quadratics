from app.services.artifacts.repository import InMemoryArtifactRepository


def test_repository_finds_reusable_completed_artifact():
    repository = InMemoryArtifactRepository()
    artifact = repository.create_attempt(
        generation_job_id="generation-1",
        user_id="user-1",
        stage="elevenlabs_audio",
        input_hash="sha256:same",
    )
    completed = repository.complete_attempt(artifact.id, payload={"durationSeconds": 2.0})

    reusable = repository.find_reusable(
        generation_job_id="generation-1",
        stage="elevenlabs_audio",
        input_hash="sha256:same",
    )

    assert reusable == completed


def test_repository_ignores_failed_artifact_for_cache_reuse():
    repository = InMemoryArtifactRepository()
    artifact = repository.create_attempt(
        generation_job_id="generation-1",
        user_id="user-1",
        stage="animation_plan",
        input_hash="sha256:plan",
    )
    repository.fail_attempt(artifact.id, error_code="provider_error", error_message="bad json")

    reusable = repository.find_reusable(
        generation_job_id="generation-1",
        stage="animation_plan",
        input_hash="sha256:plan",
    )

    assert reusable is None


def test_repository_versions_increment_per_generation_stage():
    repository = InMemoryArtifactRepository()

    first = repository.create_attempt(
        generation_job_id="generation-1",
        user_id="user-1",
        stage="teacher_script",
        input_hash="sha256:first",
    )
    second = repository.create_attempt(
        generation_job_id="generation-1",
        user_id="user-1",
        stage="teacher_script",
        input_hash="sha256:second",
    )

    assert first.version == 1
    assert second.version == 2


def test_failed_attempt_does_not_replace_latest_successful_current_artifact():
    repository = InMemoryArtifactRepository()
    first = repository.create_attempt(
        generation_job_id="generation-1",
        user_id="user-1",
        stage="motion_canvas_render",
        input_hash="sha256:first",
    )
    completed = repository.complete_attempt(first.id)
    second = repository.create_attempt(
        generation_job_id="generation-1",
        user_id="user-1",
        stage="motion_canvas_render",
        input_hash="sha256:second",
    )

    failed = repository.fail_attempt(
        second.id,
        error_code="renderer_failed",
        error_message="Motion Canvas exited with status 1.",
    )

    assert failed.is_current is False
    assert repository.get(completed.id).is_current is True
