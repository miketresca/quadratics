import {describe, expect, it} from "vitest";

import type {GameWorksheetRunSnapshot} from "../lib/api";
import {
  areWorksheetAnswersCorrect,
  checkWorksheetAnswers,
  nextWorksheetAnswerForKey,
  nextWorksheetFillTargetId,
  worksheetSectionAnswerStatus,
  worksheetActionAtCanvasPoint
} from "../components/game/game-worksheet-renderer";
import {DEFAULT_WORKSHEET_PLAYBACK} from "../components/game/game-runtime-storage";

const numericRun: GameWorksheetRunSnapshot = {
  artifacts: [
    {
      completedAt: "2026-08-22T00:00:00Z",
      configMetadata: {},
      createdAt: "2026-08-22T00:00:00Z",
      errorMessage: null,
      id: "artifact_1",
      isCurrent: true,
      modelName: null,
      payload: {
        fillTargets: [
          {
            expectedText: "12",
            id: "fill_numeric",
            inputMode: "student_text",
            pageId: "page_1",
            questionId: "numeric_question",
            rect: {height: 0.04, width: 0.12, x: 0.2, y: 0.2},
            sectionId: "do_now"
          }
        ],
        sections: [{id: "do_now", pageId: "page_1", title: "Do Now"}]
      },
      providerName: null,
      runId: "run_1",
      staleReason: null,
      stage: "interactive_bundle",
      status: "completed",
      summary: null,
      version: 1
    }
  ],
  createdAt: "2026-08-22T00:00:00Z",
  id: "run_1",
  selectedInstructorId: null,
  status: "completed",
  templateId: "numeric-test-template",
  templatePayload: {},
  templateTitle: "Volume With Whole-Number Cubes",
  updatedAt: "2026-08-22T00:00:00Z",
  userId: "user_1"
};

const staleLessonOneRun: GameWorksheetRunSnapshot = {
  ...numericRun,
  artifacts: [
    {
      ...numericRun.artifacts[0],
      payload: {
        fillTargets: [
          {
            expectedText: "3 x 4 = 12",
            id: "fill_do_now_array_equation",
            inputMode: "student_text",
            pageId: "page_1",
            questionId: "do_now_count_layers",
            rect: {height: 0.034, width: 0.52, x: 0.2, y: 0.28},
            sectionId: "do_now"
          },
          {
            expectedText: "12",
            id: "fill_do_now_array_total",
            inputMode: "student_text",
            pageId: "page_1",
            questionId: "do_now_count_layers",
            rect: {height: 0.034, width: 0.52, x: 0.2, y: 0.34},
            sectionId: "do_now"
          },
          {
            expectedText: "10",
            id: "fill_do_now_area",
            inputMode: "student_text",
            pageId: "page_1",
            questionId: "do_now_meaning",
            rect: {height: 0.034, width: 0.52, x: 0.2, y: 0.4},
            sectionId: "do_now"
          }
        ],
        sections: [{id: "do_now", pageId: "page_1", title: "Do Now"}]
      }
    }
  ],
  id: "run_lesson_1",
  templateId: "volume-cubes-lesson-1"
};

describe("worksheet answer checking", () => {
  it("rejects partial numeric answers", () => {
    const playback = {
      ...DEFAULT_WORKSHEET_PLAYBACK,
      answers: {fill_numeric: "1"}
    };

    const answerResults = checkWorksheetAnswers(numericRun, playback);

    expect(answerResults.fill_numeric?.correct).toBe(false);
    expect(areWorksheetAnswersCorrect(numericRun, {...playback, answerResults})).toBe(false);
  });

  it("accepts exact numeric answers", () => {
    const playback = {
      ...DEFAULT_WORKSHEET_PLAYBACK,
      answers: {fill_numeric: "12"}
    };

    const answerResults = checkWorksheetAnswers(numericRun, playback);

    expect(answerResults.fill_numeric?.correct).toBe(true);
    expect(areWorksheetAnswersCorrect(numericRun, {...playback, answerResults})).toBe(true);
  });

  it("does not mark blank answers wrong when checking current work", () => {
    const playback = {
      ...DEFAULT_WORKSHEET_PLAYBACK,
      answers: {
        fill_do_now_array_equation: "3 x 4 = 12",
        fill_do_now_array_total: " "
      }
    };

    const answerResults = checkWorksheetAnswers(staleLessonOneRun, playback);

    expect(answerResults.fill_do_now_array_equation?.correct).toBe(true);
    expect(answerResults.fill_do_now_array_total).toBeUndefined();
    expect(answerResults.fill_do_now_fact_3x4).toBeUndefined();
  });

  it("accepts asterisks as multiplication in equation answers", () => {
    const playback = {
      ...DEFAULT_WORKSHEET_PLAYBACK,
      answers: {
        fill_do_now_array_equation: "3*4=12"
      }
    };

    const answerResults = checkWorksheetAnswers(staleLessonOneRun, playback);

    expect(answerResults.fill_do_now_array_equation?.correct).toBe(true);
  });
});

describe("worksheet input constraints", () => {
  it("limits the Do Now equation line to math characters that fit the line", () => {
    let answer = "";
    for (const key of "3 x 4 = 1299abc") {
      answer = nextWorksheetAnswerForKey("fill_do_now_array_equation", answer, key);
    }

    expect(answer).toBe("3 x 4 = 1299");
    expect(answer).toHaveLength(12);
    expect(nextWorksheetAnswerForKey("fill_do_now_array_equation", "3 x 4 = 1299", "9")).toBe("3 x 4 = 1299");
  });

  it("limits non-equation Do Now lines to two numeric characters", () => {
    let answer = "";
    for (const key of "1a234") {
      answer = nextWorksheetAnswerForKey("fill_do_now_fact_3x4", answer, key);
    }

    expect(answer).toBe("12");
  });
});

describe("Lesson 1 Do Now input targets", () => {
  it("keeps every hard-coded Do Now line clickable and constrained even with stale bundle targets", () => {
    const expectedTargets = [
      ["fill_do_now_array_equation", 480, 662, "3 x 4 = 1299abc", "3 x 4 = 1299"],
      ["fill_do_now_array_total", 365, 732, "12abc3", "12"],
      ["fill_do_now_fact_3x4", 350, 881, "12abc3", "12"],
      ["fill_do_now_fact_4x2", 350, 931, "8a91", "89"],
      ["fill_do_now_fact_2x5", 350, 981, "10x2", "10"],
      ["fill_do_now_fact_5x6", 350, 1031, "30=4", "30"],
      ["fill_do_now_fact_4x7", 350, 1081, "28*9", "28"],
      ["fill_do_now_area", 360, 1308, "10x7", "10"]
    ] as const;

    for (const [targetId, x, y, keys, expectedAnswer] of expectedTargets) {
      const action = worksheetActionAtCanvasPoint(x, y, staleLessonOneRun, DEFAULT_WORKSHEET_PLAYBACK);

      expect(action?.type).toBe("fill_target");
      if (action?.type === "fill_target") {
        expect(action.target.id).toBe(targetId);
      }

      let answer = "";
      for (const key of keys) {
        answer = nextWorksheetAnswerForKey(targetId, answer, key);
      }
      expect(answer).toBe(expectedAnswer);
    }
  });

  it("advances through Do Now inputs in page order", () => {
    const targetOrder = [
      "fill_do_now_array_equation",
      "fill_do_now_array_total",
      "fill_do_now_fact_3x4",
      "fill_do_now_fact_4x2",
      "fill_do_now_fact_2x5",
      "fill_do_now_fact_5x6",
      "fill_do_now_fact_4x7",
      "fill_do_now_area"
    ];

    for (let index = 0; index < targetOrder.length; index += 1) {
      const nextTargetId = nextWorksheetFillTargetId(staleLessonOneRun, {
        ...DEFAULT_WORKSHEET_PLAYBACK,
        activeFillTargetId: targetOrder[index]
      });

      expect(nextTargetId).toBe(targetOrder[index + 1] ?? null);
    }
  });

  it("keeps Check Answers clickable after a previous submission", () => {
    const action = worksheetActionAtCanvasPoint(920, 1480, staleLessonOneRun, {
      ...DEFAULT_WORKSHEET_PLAYBACK,
      submittedAt: 123
    });

    expect(action?.type).toBe("submit_answers");
  });

  it("reports blank, incorrect, and complete Do Now tab states", () => {
    expect(worksheetSectionAnswerStatus(staleLessonOneRun, DEFAULT_WORKSHEET_PLAYBACK, "do_now")).toBe("blank");

    const incorrectPlayback = {
      ...DEFAULT_WORKSHEET_PLAYBACK,
      answers: {fill_do_now_array_equation: "3 x 4 = 11"},
      submittedAt: 123
    };
    const incorrectResults = checkWorksheetAnswers(staleLessonOneRun, incorrectPlayback);
    expect(worksheetSectionAnswerStatus(staleLessonOneRun, {...incorrectPlayback, answerResults: incorrectResults}, "do_now")).toBe("incorrect");

    const completePlayback = {
      ...DEFAULT_WORKSHEET_PLAYBACK,
      answers: {
        fill_do_now_array_equation: "3 x 4 = 12",
        fill_do_now_array_total: "12",
        fill_do_now_fact_3x4: "12",
        fill_do_now_fact_4x2: "8",
        fill_do_now_fact_2x5: "10",
        fill_do_now_fact_5x6: "30",
        fill_do_now_fact_4x7: "28",
        fill_do_now_area: "10"
      },
      submittedAt: 123
    };
    const completeResults = checkWorksheetAnswers(staleLessonOneRun, completePlayback);
    expect(worksheetSectionAnswerStatus(staleLessonOneRun, {...completePlayback, answerResults: completeResults}, "do_now")).toBe("complete");
  });
});
