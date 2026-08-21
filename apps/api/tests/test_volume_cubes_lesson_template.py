from app.services.game_lessons.templates.volume_cubes_lesson_1 import (
    VOLUME_CUBES_LESSON_1_PAYLOAD,
)


def test_volume_cubes_template_has_expected_major_sections():
    section_ids = [section["id"] for section in VOLUME_CUBES_LESSON_1_PAYLOAD["sections"]]

    assert section_ids == ["do_now", "vocabulary", "guided_practice"]


def test_volume_cubes_template_references_existing_questions_and_fill_targets():
    section_ids = {section["id"] for section in VOLUME_CUBES_LESSON_1_PAYLOAD["sections"]}
    question_ids = {question["id"] for question in VOLUME_CUBES_LESSON_1_PAYLOAD["questions"]}
    fill_target_ids = {target["id"] for target in VOLUME_CUBES_LESSON_1_PAYLOAD["fillTargets"]}

    for section in VOLUME_CUBES_LESSON_1_PAYLOAD["sections"]:
        assert section["regionId"]
        assert section["questionIds"]
        assert set(section["questionIds"]).issubset(question_ids)

    for question in VOLUME_CUBES_LESSON_1_PAYLOAD["questions"]:
        assert question["sectionId"] in section_ids
        assert question["answer"]
        assert set(question["fillTargetIds"]).issubset(fill_target_ids)

    for target in VOLUME_CUBES_LESSON_1_PAYLOAD["fillTargets"]:
        rect = target["rect"]
        assert target["sectionId"] in section_ids
        assert target["questionId"] in question_ids
        assert 0 <= rect["x"] <= 1
        assert 0 <= rect["y"] <= 1
        assert rect["width"] > 0
        assert rect["height"] > 0
