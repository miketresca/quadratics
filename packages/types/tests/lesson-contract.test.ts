import {describe, expect, it} from "vitest";
import fixture from "./fixtures/factoring_lesson.json";
import type {Lesson} from "../src";

describe("lesson contract", () => {
  it("accepts the factoring lesson fixture", () => {
    const lesson: Lesson = fixture as Lesson;

    expect(lesson.status).toBe("completed");
    expect(lesson.method).toBe("factoring");
    expect(lesson.solutions.map((solution) => solution.expression)).toEqual(["1/2", "3"]);
    expect(lesson.steps.map((step) => step.id)).toEqual(["factor", "solve_factors", "final_answer"]);
  });
});
