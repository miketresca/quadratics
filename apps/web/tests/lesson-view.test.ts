import {describe, expect, it} from "vitest";

import {flattenLessonMathLines, stateForLesson} from "../lib/lesson-view";
import fixture from "../../../packages/types/tests/fixtures/factoring_lesson.json";

describe("lesson view state", () => {
  it("maps completed lessons to success state", () => {
    const state = stateForLesson(fixture as never);

    expect(state.kind).toBe("success");
  });

  it("maps unsupported lessons to unsupported state", () => {
    const state = stateForLesson({...fixture, status: "unsupported_instructional_method", steps: []} as never);

    expect(state.kind).toBe("unsupported");
  });

  it("flattens completed lesson math lines in step order", () => {
    const lines = flattenLessonMathLines(fixture as never).map((line) => line.expression);

    expect(lines).toEqual([
      "2*x^2 - 7*x + 3 = 0",
      "(2*x - 1)*(x - 3) = 0",
      "2*x - 1 = 0",
      "2*x = 1",
      "x = 1/2",
      "x - 3 = 0",
      "x = 3",
      "x = 1/2, 3"
    ]);
  });

  it("does not flatten unsupported lesson math lines", () => {
    const lines = flattenLessonMathLines({
      ...fixture,
      status: "unsupported_instructional_method",
      steps: []
    } as never);

    expect(lines).toEqual([]);
  });
});
