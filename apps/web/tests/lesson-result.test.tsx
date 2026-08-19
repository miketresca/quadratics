// @vitest-environment happy-dom

import {createRoot} from "react-dom/client";
import {act} from "react";
import {afterEach, describe, expect, it, vi} from "vitest";

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

  it("renders the ElevenLabs request loading block before the audio loading block", async () => {
    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LessonResult
          lesson={scriptResponse.lesson as never}
          narrationLoading
          script={scriptResponse.script as never}
          speechMarkupLoading
        />
      );
    });

    const text = container.textContent ?? "";
    expect(text.indexOf("teacher_script")).toBeGreaterThanOrEqual(0);
    expect(text.indexOf("elevenlabs_request")).toBeGreaterThan(text.indexOf("teacher_script"));
    expect(text.indexOf("elevenlabs_audio")).toBeGreaterThan(text.indexOf("elevenlabs_request"));
    expect(container.querySelectorAll('[role="status"][aria-label="Loading"]')).toHaveLength(2);

    await act(async () => {
      root.unmount();
    });
  });

  it("renders manual run controls for script and narration steps", async () => {
    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onGenerateScript = vi.fn();
    const onGenerateNarration = vi.fn();
    const onRunFullPipeline = vi.fn();

    await act(async () => {
      root.render(
        <LessonResult
          lesson={scriptResponse.lesson as never}
          onGenerateScript={onGenerateScript}
          onRunFullPipeline={onRunFullPipeline}
        />
      );
    });

    const scriptButton = container.querySelector('button[aria-label="Run teacher_script"]');
    expect(scriptButton).not.toBeNull();
    const fullPipelineButton = container.querySelector('button[aria-label="Run full pipeline"]');
    expect(fullPipelineButton).not.toBeNull();

    await act(async () => {
      scriptButton?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
    });

    expect(onGenerateScript).toHaveBeenCalledOnce();

    await act(async () => {
      fullPipelineButton?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
    });

    expect(onRunFullPipeline).toHaveBeenCalledOnce();

    await act(async () => {
      root.render(
        <LessonResult
          lesson={scriptResponse.lesson as never}
          onGenerateNarration={onGenerateNarration}
          script={scriptResponse.script as never}
        />
      );
    });

    const narrationButton = container.querySelector('button[aria-label="Run elevenlabs_request"]');
    expect(narrationButton).not.toBeNull();

    await act(async () => {
      narrationButton?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
    });

    expect(onGenerateNarration).toHaveBeenCalledOnce();

    await act(async () => {
      root.unmount();
    });
  });

  it("disables manual run controls while a pipeline step is busy", async () => {
    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LessonResult
          actionDisabled
          lesson={scriptResponse.lesson as never}
          onGenerateNarration={vi.fn()}
          onGenerateScript={vi.fn()}
          onRetryNarration={vi.fn()}
          onRetryNarrationSegment={vi.fn()}
          onRunFullPipeline={vi.fn()}
          narration={
            {
              status: "completed",
              provider: "elevenlabs",
              voiceId: "male-voice",
              modelId: "eleven_multilingual_v2",
              durationSeconds: 3,
              speechText: "Factor first.",
              segments: [
                {
                  scriptSegmentId: "script_factor",
                  stepId: "factor",
                  title: "Factor the quadratic",
                  provider: "elevenlabs",
                  voiceId: "male-voice",
                  modelId: "eleven_multilingual_v2",
                  audioMimeType: "audio/mpeg",
                  audioBase64: "ZmFrZS0x",
                  durationSeconds: 3,
                  speechText: "Factor first."
                }
              ]
            } as never
          }
          script={scriptResponse.script as never}
        />
      );
    });

    expect(container.querySelector('button[aria-label="Run full pipeline"]')).toHaveProperty("disabled", true);
    expect(container.querySelector('button[aria-label="Regenerate ElevenLabs audio"]')).toHaveProperty("disabled", true);
    expect(
      container.querySelector('button[aria-label="Regenerate ElevenLabs audio for Factor the quadratic"]')
    ).toHaveProperty("disabled", true);

    await act(async () => {
      root.unmount();
    });
  });

  it("renders the ElevenLabs request text when narration fails", async () => {
    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LessonResult
          lesson={scriptResponse.lesson as never}
          narration={
            {
              status: "unsupported",
              provider: null,
              unsupportedReason: "ElevenLabs payment is required or the account has insufficient credits.",
              speechText: 'First factor the quadratic.<break time="0.7s" />Then solve each factor.'
            } as never
          }
          script={scriptResponse.script as never}
        />
      );
    });

    expect(container.textContent).toContain("elevenlabs_request");
    expect(container.textContent).toContain('break time="0.7s"');
    expect(container.textContent).toContain("insufficient credits");

    await act(async () => {
      root.unmount();
    });
  });

  it("calls the retry handler from the ElevenLabs audio log", async () => {
    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onRetryNarration = vi.fn();

    await act(async () => {
      root.render(
        <LessonResult
          lesson={scriptResponse.lesson as never}
          narration={
            {
              status: "unsupported",
              provider: null,
              unsupportedReason: "ElevenLabs payment is required.",
              speechText: 'First factor the quadratic.<break time="0.7s" />'
            } as never
          }
          onRetryNarration={onRetryNarration}
          script={scriptResponse.script as never}
        />
      );
    });

    const button = container.querySelector('button[aria-label="Regenerate ElevenLabs audio"]');
    expect(button).not.toBeNull();

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
    });

    expect(onRetryNarration).toHaveBeenCalledOnce();

    await act(async () => {
      root.unmount();
    });
  });

  it("renders segmented ElevenLabs audio with per-segment retry controls", async () => {
    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onRetryNarrationSegment = vi.fn();

    await act(async () => {
      root.render(
        <LessonResult
          lesson={scriptResponse.lesson as never}
          narration={
            {
              status: "completed",
              provider: "elevenlabs",
              voiceId: "male-voice",
              modelId: "eleven_multilingual_v2",
              durationSeconds: 6,
              speechText: "Factor first. Then solve.",
              segments: [
                {
                  scriptSegmentId: "script_factor",
                  stepId: "factor",
                  title: "Factor the quadratic",
                  provider: "elevenlabs",
                  voiceId: "male-voice",
                  modelId: "eleven_multilingual_v2",
                  audioMimeType: "audio/mpeg",
                  audioBase64: "ZmFrZS0x",
                  durationSeconds: 3,
                  speechText: "Factor first."
                },
                {
                  scriptSegmentId: "script_solve_factors",
                  stepId: "solve_factors",
                  title: "Solve each factor",
                  provider: "elevenlabs",
                  voiceId: "male-voice",
                  modelId: "eleven_multilingual_v2",
                  audioMimeType: "audio/mpeg",
                  audioBase64: "ZmFrZS0y",
                  durationSeconds: 3,
                  speechText: "Then solve."
                }
              ]
            } as never
          }
          onRetryNarrationSegment={onRetryNarrationSegment}
          script={scriptResponse.script as never}
        />
      );
    });

    expect(container.textContent).toContain("Factor first.");
    expect(container.textContent).toContain("Then solve.");
    expect(container.querySelectorAll("audio")).toHaveLength(2);

    const button = container.querySelector(
      'button[aria-label="Regenerate ElevenLabs audio for Solve each factor"]'
    );
    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
    });

    expect(onRetryNarrationSegment).toHaveBeenCalledWith("script_solve_factors");

    await act(async () => {
      root.unmount();
    });
  });
});
