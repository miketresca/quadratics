from __future__ import annotations

from copy import deepcopy
from typing import Any

from app.schemas.game_lessons import GameWorksheetTemplate

TEMPLATE_ID = "volume-cubes-lesson-1"

# This is the deterministic map for the first worksheet experience. Coordinates
# are normalized against the page so the browser can render the same targets at
# any paper size while the LLM receives stable section/question IDs.
VOLUME_CUBES_LESSON_1_PAYLOAD: dict[str, Any] = {
    "templateId": TEMPLATE_ID,
    "title": "Volume With Whole-Number Cubes",
    "version": 1,
    "source": {
        "kind": "pdf",
        "path": "misc/task/task_lesson.pdf",
        "notes": "Manual v1 template extracted from the task lesson PDF.",
    },
    "learningGoal": (
        "Students understand volume as the number of whole-number unit cubes that "
        "fill a rectangular prism."
    ),
    "studentAudience": "Sixth-grade math students",
    "guardrails": [
        "Keep narration concrete and visual.",
        "Use whole-number dimensions only.",
        "Reference only the worksheet sections, questions, and fill targets declared "
        "in this template.",
        "Do not introduce formulas before the vocabulary section names them.",
    ],
    "pages": [
        {
            "id": "page_1",
            "pageNumber": 1,
            "width": 1,
            "height": 1,
            "regions": [
                {
                    "id": "do_now_region",
                    "kind": "section",
                    "rect": {"x": 0.07, "y": 0.14, "width": 0.86, "height": 0.26},
                },
                {
                    "id": "vocabulary_region",
                    "kind": "section",
                    "rect": {"x": 0.07, "y": 0.43, "width": 0.86, "height": 0.28},
                },
            ],
        },
        {
            "id": "page_2",
            "pageNumber": 2,
            "width": 1,
            "height": 1,
            "regions": [
                {
                    "id": "guided_practice_region",
                    "kind": "section",
                    "rect": {"x": 0.07, "y": 0.1, "width": 0.86, "height": 0.72},
                },
            ],
        },
    ],
    "sections": [
        {
            "id": "do_now",
            "title": "Do Now",
            "pageId": "page_1",
            "regionId": "do_now_region",
            "summary": "Warm up by counting and organizing unit cubes.",
            "targetDurationSeconds": 45,
            "questionIds": ["do_now_count_layers", "do_now_dimensions", "do_now_meaning"],
        },
        {
            "id": "vocabulary",
            "title": "Vocabulary",
            "pageId": "page_1",
            "regionId": "vocabulary_region",
            "summary": "Define volume and cubic units before using the formula.",
            "targetDurationSeconds": 45,
            "questionIds": ["vocab_volume", "vocab_cubic_unit"],
        },
        {
            "id": "guided_practice",
            "title": "Guided Practice",
            "pageId": "page_2",
            "regionId": "guided_practice_region",
            "summary": "Complete a four-row table using length times width times height.",
            "targetDurationSeconds": 75,
            "questionIds": [
                "guided_row_1",
                "guided_row_2",
                "guided_row_3",
                "guided_row_4",
            ],
        },
    ],
    "questions": [
        {
            "id": "do_now_count_layers",
            "sectionId": "do_now",
            "prompt": "How can we count the cubes without losing track?",
            "answer": "Count one layer, then multiply by the number of layers.",
            "fillTargetIds": ["fill_do_now_count_layers"],
        },
        {
            "id": "do_now_dimensions",
            "sectionId": "do_now",
            "prompt": "What dimensions describe the rectangular prism?",
            "answer": "Length, width, and height describe the prism.",
            "fillTargetIds": ["fill_do_now_dimensions"],
        },
        {
            "id": "do_now_meaning",
            "sectionId": "do_now",
            "prompt": "What does the final count represent?",
            "answer": "It represents how many unit cubes fill the prism.",
            "fillTargetIds": ["fill_do_now_meaning"],
        },
        {
            "id": "vocab_volume",
            "sectionId": "vocabulary",
            "prompt": "Define volume.",
            "answer": "Volume is the amount of space inside a three-dimensional figure.",
            "fillTargetIds": ["fill_vocab_volume"],
        },
        {
            "id": "vocab_cubic_unit",
            "sectionId": "vocabulary",
            "prompt": "Define cubic unit.",
            "answer": "A cubic unit is one unit cube used to measure volume.",
            "fillTargetIds": ["fill_vocab_cubic_unit"],
        },
        {
            "id": "guided_row_1",
            "sectionId": "guided_practice",
            "prompt": "Find the volume for dimensions 2 by 3 by 4.",
            "answer": "2 x 3 x 4 = 24 cubic units",
            "fillTargetIds": ["fill_guided_row_1"],
        },
        {
            "id": "guided_row_2",
            "sectionId": "guided_practice",
            "prompt": "Find the volume for dimensions 5 by 2 by 3.",
            "answer": "5 x 2 x 3 = 30 cubic units",
            "fillTargetIds": ["fill_guided_row_2"],
        },
        {
            "id": "guided_row_3",
            "sectionId": "guided_practice",
            "prompt": "Find the volume for dimensions 4 by 4 by 2.",
            "answer": "4 x 4 x 2 = 32 cubic units",
            "fillTargetIds": ["fill_guided_row_3"],
        },
        {
            "id": "guided_row_4",
            "sectionId": "guided_practice",
            "prompt": "Find the volume for dimensions 6 by 3 by 2.",
            "answer": "6 x 3 x 2 = 36 cubic units",
            "fillTargetIds": ["fill_guided_row_4"],
        },
    ],
    "fillTargets": [
        {
            "id": "fill_do_now_count_layers",
            "sectionId": "do_now",
            "questionId": "do_now_count_layers",
            "pageId": "page_1",
            "rect": {"x": 0.12, "y": 0.22, "width": 0.76, "height": 0.045},
            "expectedText": "Count one layer, then multiply by layers.",
        },
        {
            "id": "fill_do_now_dimensions",
            "sectionId": "do_now",
            "questionId": "do_now_dimensions",
            "pageId": "page_1",
            "rect": {"x": 0.12, "y": 0.29, "width": 0.76, "height": 0.045},
            "expectedText": "Length, width, and height.",
        },
        {
            "id": "fill_do_now_meaning",
            "sectionId": "do_now",
            "questionId": "do_now_meaning",
            "pageId": "page_1",
            "rect": {"x": 0.12, "y": 0.36, "width": 0.76, "height": 0.045},
            "expectedText": "The total number of unit cubes.",
        },
        {
            "id": "fill_vocab_volume",
            "sectionId": "vocabulary",
            "questionId": "vocab_volume",
            "pageId": "page_1",
            "rect": {"x": 0.12, "y": 0.51, "width": 0.76, "height": 0.05},
            "expectedText": "Volume is space inside a 3D figure.",
        },
        {
            "id": "fill_vocab_cubic_unit",
            "sectionId": "vocabulary",
            "questionId": "vocab_cubic_unit",
            "pageId": "page_1",
            "rect": {"x": 0.12, "y": 0.6, "width": 0.76, "height": 0.05},
            "expectedText": "A cubic unit is one unit cube.",
        },
        {
            "id": "fill_guided_row_1",
            "sectionId": "guided_practice",
            "questionId": "guided_row_1",
            "pageId": "page_2",
            "rect": {"x": 0.62, "y": 0.22, "width": 0.24, "height": 0.045},
            "expectedText": "24 cubic units",
        },
        {
            "id": "fill_guided_row_2",
            "sectionId": "guided_practice",
            "questionId": "guided_row_2",
            "pageId": "page_2",
            "rect": {"x": 0.62, "y": 0.32, "width": 0.24, "height": 0.045},
            "expectedText": "30 cubic units",
        },
        {
            "id": "fill_guided_row_3",
            "sectionId": "guided_practice",
            "questionId": "guided_row_3",
            "pageId": "page_2",
            "rect": {"x": 0.62, "y": 0.42, "width": 0.24, "height": 0.045},
            "expectedText": "32 cubic units",
        },
        {
            "id": "fill_guided_row_4",
            "sectionId": "guided_practice",
            "questionId": "guided_row_4",
            "pageId": "page_2",
            "rect": {"x": 0.62, "y": 0.52, "width": 0.24, "height": 0.045},
            "expectedText": "36 cubic units",
        },
    ],
}


def volume_cubes_lesson_1_payload() -> dict[str, Any]:
    return deepcopy(VOLUME_CUBES_LESSON_1_PAYLOAD)


VOLUME_CUBES_LESSON_1_TEMPLATE = GameWorksheetTemplate(
    id=TEMPLATE_ID,
    title="Volume With Whole-Number Cubes",
    version=1,
    payload=volume_cubes_lesson_1_payload(),
)
