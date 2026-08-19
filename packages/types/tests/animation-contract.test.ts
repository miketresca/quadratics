import {describe, expect, it} from "vitest";
import fixture from "./fixtures/animation_plan.json";
import type {AnimationPlan} from "../src";

describe("animation plan contract", () => {
  it("accepts a constrained blackboard animation plan fixture", () => {
    const plan = fixture as AnimationPlan;

    expect(plan.version).toBe("animation-plan/v1");
    expect(plan.layout.verticalFlow).toBe(true);
    expect(plan.cues.map((cue) => cue.visual.action)).toEqual(["write_math", "write_math"]);
    expect(plan.cues[0].trigger.type).toBe("narration_text");
  });
});
