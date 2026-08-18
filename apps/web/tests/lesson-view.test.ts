import {describe, expect, it} from "vitest";

import {stateForLesson} from "../lib/lesson-view";
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
});
