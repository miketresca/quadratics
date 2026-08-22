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
                    "rect": {"x": 0.06, "y": 0.16, "width": 0.88, "height": 0.38},
                },
                {
                    "id": "vocabulary_region",
                    "kind": "section",
                    "rect": {"x": 0.06, "y": 0.55, "width": 0.88, "height": 0.4},
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
                    "rect": {"x": 0.06, "y": 0.12, "width": 0.88, "height": 0.78},
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
            "prompt": "How many squares are in an array of 3 rows of 4 squares?",
            "answer": "3 x 4 = 12, so there are 12 squares in all.",
            "fillTargetIds": ["fill_do_now_array_equation", "fill_do_now_array_total"],
        },
        {
            "id": "do_now_dimensions",
            "sectionId": "do_now",
            "prompt": "Solve the five multiplication facts.",
            "answer": "3 x 4 = 12, 4 x 2 = 8, 2 x 5 = 10, 5 x 6 = 30, and 4 x 7 = 28.",
            "fillTargetIds": [
                "fill_do_now_fact_3x4",
                "fill_do_now_fact_4x2",
                "fill_do_now_fact_2x5",
                "fill_do_now_fact_5x6",
                "fill_do_now_fact_4x7",
            ],
        },
        {
            "id": "do_now_meaning",
            "sectionId": "do_now",
            "prompt": "Find the area of a rectangle that is 5 units by 2 units.",
            "answer": "The area is 10 square units.",
            "fillTargetIds": ["fill_do_now_area"],
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
            "prompt": "Complete row 1 of the guided-practice table.",
            "answer": "There are 12 cubes per layer, 1 layer, and 12 cubic units.",
            "fillTargetIds": [
                "fill_guided_row_1_layer",
                "fill_guided_row_1_layers",
                "fill_guided_row_1_volume",
            ],
        },
        {
            "id": "guided_row_2",
            "sectionId": "guided_practice",
            "prompt": "Complete row 2 of the guided-practice table.",
            "answer": "There are 4 cubes per layer, 3 layers, and 12 cubic units.",
            "fillTargetIds": [
                "fill_guided_row_2_layer",
                "fill_guided_row_2_layers",
                "fill_guided_row_2_volume",
            ],
        },
        {
            "id": "guided_row_3",
            "sectionId": "guided_practice",
            "prompt": "Complete row 3 of the guided-practice table.",
            "answer": "There are 12 cubes per layer, 2 layers, and 24 cubic units.",
            "fillTargetIds": [
                "fill_guided_row_3_layer",
                "fill_guided_row_3_layers",
                "fill_guided_row_3_volume",
            ],
        },
        {
            "id": "guided_row_4",
            "sectionId": "guided_practice",
            "prompt": "Complete row 4 of the guided-practice table.",
            "answer": "There are 20 cubes per layer, 2 layers, and 40 cubic units.",
            "fillTargetIds": [
                "fill_guided_row_4_layer",
                "fill_guided_row_4_layers",
                "fill_guided_row_4_volume",
            ],
        },
    ],
    "fillTargets": [
        {
            "id": "fill_do_now_array_equation",
            "sectionId": "do_now",
            "inputMode": "student_text",
            "questionId": "do_now_count_layers",
            "pageId": "page_1",
            "rect": {"x": 0.315, "y": 0.283, "width": 0.275, "height": 0.034},
            "expectedText": "3 x 4 = 12",
        },
        {
            "id": "fill_do_now_array_total",
            "sectionId": "do_now",
            "inputMode": "student_text",
            "questionId": "do_now_count_layers",
            "pageId": "page_1",
            "rect": {"x": 0.735, "y": 0.283, "width": 0.08, "height": 0.034},
            "expectedText": "12",
        },
        {
            "id": "fill_do_now_fact_3x4",
            "sectionId": "do_now",
            "inputMode": "student_text",
            "questionId": "do_now_dimensions",
            "pageId": "page_1",
            "rect": {"x": 0.222, "y": 0.362, "width": 0.06, "height": 0.035},
            "expectedText": "12",
        },
        {
            "id": "fill_do_now_fact_4x2",
            "sectionId": "do_now",
            "inputMode": "student_text",
            "questionId": "do_now_dimensions",
            "pageId": "page_1",
            "rect": {"x": 0.37, "y": 0.362, "width": 0.06, "height": 0.035},
            "expectedText": "8",
        },
        {
            "id": "fill_do_now_fact_2x5",
            "sectionId": "do_now",
            "inputMode": "student_text",
            "questionId": "do_now_dimensions",
            "pageId": "page_1",
            "rect": {"x": 0.515, "y": 0.362, "width": 0.06, "height": 0.035},
            "expectedText": "10",
        },
        {
            "id": "fill_do_now_fact_5x6",
            "sectionId": "do_now",
            "inputMode": "student_text",
            "questionId": "do_now_dimensions",
            "pageId": "page_1",
            "rect": {"x": 0.665, "y": 0.362, "width": 0.06, "height": 0.035},
            "expectedText": "30",
        },
        {
            "id": "fill_do_now_fact_4x7",
            "sectionId": "do_now",
            "inputMode": "student_text",
            "questionId": "do_now_dimensions",
            "pageId": "page_1",
            "rect": {"x": 0.817, "y": 0.362, "width": 0.06, "height": 0.035},
            "expectedText": "28",
        },
        {
            "id": "fill_do_now_area",
            "sectionId": "do_now",
            "inputMode": "student_text",
            "questionId": "do_now_meaning",
            "pageId": "page_1",
            "rect": {"x": 0.392, "y": 0.47, "width": 0.14, "height": 0.035},
            "expectedText": "10",
        },
        {
            "id": "fill_vocab_volume",
            "sectionId": "vocabulary",
            "inputMode": "read_only",
            "questionId": "vocab_volume",
            "pageId": "page_1",
            "rect": {"x": 0.19, "y": 0.612, "width": 0.68, "height": 0.038},
            "expectedText": (
                "The amount of space a solid figure takes up, measured in cubic units."
            ),
        },
        {
            "id": "fill_vocab_cubic_unit",
            "sectionId": "vocabulary",
            "inputMode": "read_only",
            "questionId": "vocab_cubic_unit",
            "pageId": "page_1",
            "rect": {"x": 0.19, "y": 0.742, "width": 0.64, "height": 0.048},
            "expectedText": "A unit cube used to measure volume.",
        },
        {
            "id": "fill_guided_row_1_layer",
            "sectionId": "guided_practice",
            "inputMode": "student_text",
            "questionId": "guided_row_1",
            "pageId": "page_2",
            "rect": {"x": 0.44, "y": 0.27, "width": 0.1, "height": 0.045},
            "expectedText": "12",
        },
        {
            "id": "fill_guided_row_1_layers",
            "sectionId": "guided_practice",
            "inputMode": "student_text",
            "questionId": "guided_row_1",
            "pageId": "page_2",
            "rect": {"x": 0.615, "y": 0.27, "width": 0.1, "height": 0.045},
            "expectedText": "1",
        },
        {
            "id": "fill_guided_row_1_volume",
            "sectionId": "guided_practice",
            "inputMode": "student_text",
            "questionId": "guided_row_1",
            "pageId": "page_2",
            "rect": {"x": 0.79, "y": 0.27, "width": 0.1, "height": 0.045},
            "expectedText": "12",
        },
        {
            "id": "fill_guided_row_2_layer",
            "sectionId": "guided_practice",
            "inputMode": "student_text",
            "questionId": "guided_row_2",
            "pageId": "page_2",
            "rect": {"x": 0.44, "y": 0.43, "width": 0.1, "height": 0.045},
            "expectedText": "4",
        },
        {
            "id": "fill_guided_row_2_layers",
            "sectionId": "guided_practice",
            "inputMode": "student_text",
            "questionId": "guided_row_2",
            "pageId": "page_2",
            "rect": {"x": 0.615, "y": 0.43, "width": 0.1, "height": 0.045},
            "expectedText": "3",
        },
        {
            "id": "fill_guided_row_2_volume",
            "sectionId": "guided_practice",
            "inputMode": "student_text",
            "questionId": "guided_row_2",
            "pageId": "page_2",
            "rect": {"x": 0.79, "y": 0.43, "width": 0.1, "height": 0.045},
            "expectedText": "12",
        },
        {
            "id": "fill_guided_row_3_layer",
            "sectionId": "guided_practice",
            "inputMode": "student_text",
            "questionId": "guided_row_3",
            "pageId": "page_2",
            "rect": {"x": 0.44, "y": 0.59, "width": 0.1, "height": 0.045},
            "expectedText": "12",
        },
        {
            "id": "fill_guided_row_3_layers",
            "sectionId": "guided_practice",
            "inputMode": "student_text",
            "questionId": "guided_row_3",
            "pageId": "page_2",
            "rect": {"x": 0.615, "y": 0.59, "width": 0.1, "height": 0.045},
            "expectedText": "2",
        },
        {
            "id": "fill_guided_row_3_volume",
            "sectionId": "guided_practice",
            "inputMode": "student_text",
            "questionId": "guided_row_3",
            "pageId": "page_2",
            "rect": {"x": 0.79, "y": 0.59, "width": 0.1, "height": 0.045},
            "expectedText": "24",
        },
        {
            "id": "fill_guided_row_4_layer",
            "sectionId": "guided_practice",
            "inputMode": "student_text",
            "questionId": "guided_row_4",
            "pageId": "page_2",
            "rect": {"x": 0.44, "y": 0.75, "width": 0.1, "height": 0.045},
            "expectedText": "20",
        },
        {
            "id": "fill_guided_row_4_layers",
            "sectionId": "guided_practice",
            "inputMode": "student_text",
            "questionId": "guided_row_4",
            "pageId": "page_2",
            "rect": {"x": 0.615, "y": 0.75, "width": 0.1, "height": 0.045},
            "expectedText": "2",
        },
        {
            "id": "fill_guided_row_4_volume",
            "sectionId": "guided_practice",
            "inputMode": "student_text",
            "questionId": "guided_row_4",
            "pageId": "page_2",
            "rect": {"x": 0.79, "y": 0.75, "width": 0.1, "height": 0.045},
            "expectedText": "40",
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
