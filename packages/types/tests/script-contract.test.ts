import {describe, expect, it} from "vitest";
import fixture from "./fixtures/factoring_script_response.json";
import type {ScriptEquationResponse} from "../src";

describe("script contract", () => {
  it("accepts a factoring script response fixture", () => {
    const response: ScriptEquationResponse = fixture as ScriptEquationResponse;

    expect(response.lesson.method).toBe("factoring");
    expect(response.script.status).toBe("completed");
    expect(response.script.segments.map((segment) => segment.stepId)).toEqual([
      "factor",
      "solve_factors",
      "final_answer"
    ]);
  });
});
