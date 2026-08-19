import {describe, expect, it} from "vitest";
import lessonFixture from "../../../fixtures/golden/x2-plus-5x-plus-6/lesson.json";
import narrationFixture from "../../../fixtures/golden/x2-plus-5x-plus-6/narration.json";
import scriptFixture from "../../../fixtures/golden/x2-plus-5x-plus-6/script.json";
import type {LessonNarration, Lesson, LessonScript} from "../src";

describe("golden fixture contract", () => {
  it("accepts the no-provider quadratic video fixture", () => {
    const lesson = lessonFixture as Lesson;
    const script = scriptFixture as LessonScript;
    const narration = narrationFixture as LessonNarration;

    expect(lesson.normalizedEquation).toBe("x**2 + 5*x + 6 = 0");
    expect(script.segments.map((segment) => segment.stepId)).toEqual([
      "factor",
      "solve_factors",
      "final_answer"
    ]);
    expect(narration.provider).toBe("development");
    expect(narration.segments?.[0]?.normalizedAlignment?.characters.length).toBeGreaterThan(0);
  });
});
