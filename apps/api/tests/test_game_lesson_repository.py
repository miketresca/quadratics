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
async def test_game_lesson_runs_section_script_as_approval_gated_artifact():
    repository = InMemoryGameLessonRepository()
    run = await repository.create_or_get_run(
        "user-a",
        "volume-cubes-lesson-1",
        GameWorksheetRunCreateRequest(),
    )
    await repository.run_stage("user-a", run.id, "template", GameLessonRunStageRequest())

    snapshot = await repository.run_stage(
        "user-a", run.id, "section_script", GameLessonRunStageRequest()
    )

    section_script = next(
        artifact for artifact in snapshot.artifacts if artifact.stage == "section_script"
    )
    assert section_script.status == "awaiting_approval"
    assert [section["sectionId"] for section in section_script.payload["sections"]] == [
        "do_now",
        "vocabulary",
        "guided_practice",
    ]
    assert section_script.payload["targetTotalSeconds"] == 165


@pytest.mark.asyncio
async def test_game_lesson_requires_script_approval_before_speech_markup():
    repository = InMemoryGameLessonRepository()
    run = await repository.create_or_get_run(
        "user-a",
        "volume-cubes-lesson-1",
        GameWorksheetRunCreateRequest(),
    )
    await repository.run_stage("user-a", run.id, "template", GameLessonRunStageRequest())
    await repository.run_stage("user-a", run.id, "section_script", GameLessonRunStageRequest())

    with pytest.raises(GameLessonStageBlocked, match="requires approved section_script"):
        await repository.run_stage("user-a", run.id, "speech_markup", GameLessonRunStageRequest())


@pytest.mark.asyncio
async def test_game_lesson_runs_speech_markup_after_script_approval():
    repository = InMemoryGameLessonRepository()
    run = await repository.create_or_get_run(
        "user-a",
        "volume-cubes-lesson-1",
        GameWorksheetRunCreateRequest(),
    )
    await repository.run_stage("user-a", run.id, "template", GameLessonRunStageRequest())
    scripted = await repository.run_stage(
        "user-a", run.id, "section_script", GameLessonRunStageRequest()
    )
    script_artifact = next(
        artifact for artifact in scripted.artifacts if artifact.stage == "section_script"
    )
    await repository.approve_artifact(
        "user-a",
        script_artifact.id,
        GameLessonArtifactApprovalRequest(decision="approved"),
    )

    snapshot = await repository.run_stage(
        "user-a", run.id, "speech_markup", GameLessonRunStageRequest()
    )

    markup = next(artifact for artifact in snapshot.artifacts if artifact.stage == "speech_markup")
    assert markup.status == "awaiting_approval"
    assert markup.payload["sections"][0]["speechText"].count('<break time="0.5s" />') >= 1
