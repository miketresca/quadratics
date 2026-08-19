import {describe, expect, it} from "vitest";
import fixture from "./fixtures/animation_plan.json";
import timelineFixture from "./fixtures/resolved_timeline.json";
import type {AnimationPlan, ResolvedAnimationTimeline} from "../src";

describe("animation plan contract", () => {
  it("accepts a constrained blackboard animation plan fixture", () => {
    const plan = fixture as AnimationPlan;

    expect(plan.version).toBe("animation-plan/v1");
    expect(plan.layout.verticalFlow).toBe(true);
    expect(plan.cues.map((cue) => cue.visual.action)).toEqual(["write_math", "write_math"]);
    expect(plan.cues[0].trigger.type).toBe("narration_text");
  });

  it("accepts a resolved timeline fixture", () => {
    const timeline = timelineFixture as ResolvedAnimationTimeline;

    expect(timeline.version).toBe("resolved-animation-timeline/v1");
    expect(timeline.cues[0].sfx?.type).toBe("chalk_write");
  });
});
