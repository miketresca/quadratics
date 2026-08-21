from app.schemas.game_lessons import GameWorksheetRunSnapshot, GameWorksheetTemplate


def test_game_lesson_schema_uses_camel_case_aliases():
    snapshot = GameWorksheetRunSnapshot(
        id="run-1",
        template_id="volume-cubes-lesson-1",
        user_id="user-1",
        selected_instructor_id="male",
        status="active",
        template=GameWorksheetTemplate(
            id="volume-cubes-lesson-1",
            title="Volume With Whole-Number Cubes",
            version=1,
            payload={},
        ),
        artifacts=[],
        created_at="2026-08-21T00:00:00+00:00",
        updated_at="2026-08-21T00:00:00+00:00",
    )

    payload = snapshot.model_dump(by_alias=True)

    assert payload["templateId"] == "volume-cubes-lesson-1"
    assert payload["selectedInstructorId"] == "male"
    assert "template_id" not in payload
