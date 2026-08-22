import {describe, expect, it} from "vitest";

import type {GameWorksheetRunSnapshot} from "../lib/api";
import {areWorksheetAnswersCorrect, checkWorksheetAnswers, nextWorksheetAnswerForKey} from "../components/game/game-worksheet-renderer";
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
  templateId: "volume-cubes-lesson-1",
  templatePayload: {},
  templateTitle: "Volume With Whole-Number Cubes",
  updatedAt: "2026-08-22T00:00:00Z",
  userId: "user_1"
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
