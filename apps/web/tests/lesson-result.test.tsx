// @vitest-environment happy-dom

import {createRoot} from "react-dom/client";
import {act} from "react";
import {afterEach, describe, expect, it} from "vitest";

import {LessonResult} from "../components/lesson-result";
import fixture from "../../../packages/types/tests/fixtures/factoring_lesson.json";
import scriptResponse from "../../../packages/types/tests/fixtures/factoring_script_response.json";

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

describe("LessonResult", () => {
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    container?.remove();
    container = null;
  });

  it("renders completed lesson solution lines", async () => {
    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LessonResult lesson={fixture as never} />);
    });

    expect(container.textContent).toContain("solution_lines");
    expect(container.textContent).toContain("2*x = 1");
    expect(container.textContent).toContain("x = 1/2, 3");

    await act(async () => {
      root.unmount();
    });
  });

  it("omits solution lines for unsupported lessons", async () => {
    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LessonResult
          lesson={
            {
              ...fixture,
              status: "unsupported_instructional_method",
              steps: []
            } as never
          }
        />
      );
    });

    expect(container.textContent).not.toContain("solution_lines");

    await act(async () => {
      root.unmount();
    });
  });

  it("renders completed script segments", async () => {
    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LessonResult lesson={scriptResponse.lesson as never} script={scriptResponse.script as never} />);
    });

    expect(container.textContent).toContain("teacher_script");
    expect(container.textContent).toContain("Factor the quadratic");
    expect(container.textContent).toContain("zero product property");
    expect(container.textContent).toContain("first_isolate_x_term");

    await act(async () => {
      root.unmount();
    });
  });
});
