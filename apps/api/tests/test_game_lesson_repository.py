import pytest

from app.schemas.game_lessons import (
    GameLessonArtifactApprovalRequest,
    GameLessonRunStageRequest,
    GameWorksheetRunCreateRequest,
)
from app.services.game_lessons.repository import (
    GameLessonRunNotFound,
    GameLessonStageBlocked,
    InMemoryGameLessonRepository,
)


@pytest.mark.asyncio
async def test_game_lesson_run_is_user_owned():
    repository = InMemoryGameLessonRepository()
    run = await repository.create_or_get_run(
        "user-a",
        "volume-cubes-lesson-1",
        GameWorksheetRunCreateRequest(),
    )

    with pytest.raises(GameLessonRunNotFound):
        await repository.get_run("user-b", run.id)


@pytest.mark.asyncio
async def test_game_lesson_run_reuses_user_template_and_instructor():
    repository = InMemoryGameLessonRepository()

    first = await repository.create_or_get_run(
        "user-a",
        "volume-cubes-lesson-1",
        GameWorksheetRunCreateRequest(selected_instructor_id="male"),
    )
    second = await repository.create_or_get_run(
        "user-a",
        "volume-cubes-lesson-1",
        GameWorksheetRunCreateRequest(selected_instructor_id="male"),
    )
    other_instructor = await repository.create_or_get_run(
        "user-a",
        "volume-cubes-lesson-1",
        GameWorksheetRunCreateRequest(selected_instructor_id="female"),
    )

    assert first.id == second.id
    assert other_instructor.id != first.id


@pytest.mark.asyncio
async def test_game_lesson_artifacts_version_and_stale_descendants():
    repository = InMemoryGameLessonRepository()
    run = await repository.create_or_get_run(
        "user-a",
        "volume-cubes-lesson-1",
        GameWorksheetRunCreateRequest(),
    )
    run_record = repository._runs[run.id]
    repository._create_artifact(run_record, "template")
    repository._create_artifact(run_record, "section_script")

    rerun = await repository.run_stage(
        "user-a",
        run.id,
        "template",
        GameLessonRunStageRequest(force=True),
    )

    template_versions = [artifact for artifact in rerun.artifacts if artifact.stage == "template"]
    stale_scripts = [artifact for artifact in rerun.artifacts if artifact.stage == "section_script"]
    assert [artifact.version for artifact in template_versions] == [1, 2]
    assert template_versions[0].is_current is False
    assert template_versions[1].is_current is True
    assert stale_scripts[0].status == "stale"
    assert stale_scripts[0].stale_reason == "template was regenerated"


@pytest.mark.asyncio
async def test_game_lesson_only_current_artifact_can_be_approved():
    repository = InMemoryGameLessonRepository()
    run = await repository.create_or_get_run(
        "user-a",
        "volume-cubes-lesson-1",
        GameWorksheetRunCreateRequest(),
    )
    first = await repository.run_stage(
        "user-a",
        run.id,
        "template",
        GameLessonRunStageRequest(),
    )
    stale_artifact = first.artifacts[0]
    await repository.run_stage("user-a", run.id, "template", GameLessonRunStageRequest(force=True))

    with pytest.raises(GameLessonStageBlocked):
        await repository.approve_artifact(
            "user-a",
            stale_artifact.id,
            GameLessonArtifactApprovalRequest(decision="approved"),
        )


@pytest.mark.asyncio
async def test_game_lesson_blocks_provider_stage_until_pipeline_slice_exists():
    repository = InMemoryGameLessonRepository()
    run = await repository.create_or_get_run(
        "user-a",
        "volume-cubes-lesson-1",
        GameWorksheetRunCreateRequest(),
    )
    await repository.run_stage("user-a", run.id, "template", GameLessonRunStageRequest())

    with pytest.raises(GameLessonStageBlocked, match="not implemented yet"):
        await repository.run_stage("user-a", run.id, "section_script", GameLessonRunStageRequest())
