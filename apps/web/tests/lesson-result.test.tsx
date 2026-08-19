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

  it("shows a deterministic parabola explorer on the Lesson tab", async () => {
    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LessonResult lesson={fixture as never} />);
    });

    const lessonTab = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Lesson");
    await act(async () => {
      lessonTab?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
    });

    expect(container.textContent).toContain("IRL Example");
    expect(container.textContent).toContain("Vertex");
    expect(container.textContent).toContain("Graph");
    expect(container.textContent).toContain("Run real_world_context from the Logs tab");
    expect(container.querySelector('button[aria-label="Generate real-world context"]')).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it("omits downstream pipeline logs for unsupported lessons", async () => {
    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LessonResult
          generation={
            {
              job: {
                id: "unsupported-generation",
                userId: "user-1",
                equationInput: "x^2 - 2x + 99",
                status: "completed",
                creditsUsed: 0
              },
              lesson: {
                ...fixture,
                status: "unsupported_instructional_method",
                steps: []
              },
              artifacts: [
                {
                  id: "render-artifact",
                  generationJobId: "unsupported-generation",
                  userId: "user-1",
                  stage: "motion_canvas_render",
                  version: 1,
                  status: "completed",
                  inputHash: "sha256:render",
                  payload: {durationSeconds: 1},
                  isCurrent: true,
                  createdAt: "2026-08-18T00:00:00Z"
                }
              ]
            } as never
          }
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
    expect(container.textContent).not.toContain("teacher_script");
    expect(container.textContent).not.toContain("motion_canvas_render");
    expect(container.querySelector('button[aria-label="Run teacher_script"]')).toBeNull();

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

  it("can regenerate a completed teacher script and shows its loading spinner", async () => {
    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onRunStage = vi.fn();

    await act(async () => {
      root.render(
        <LessonResult
          generation={
            {
              job: {
                id: "generation-script",
                userId: "user-1",
                equationInput: "x^2 + 5x + 6",
                status: "completed",
                creditsUsed: 0
              },
              lesson: scriptResponse.lesson,
              artifacts: [
                {
                  id: "script-artifact",
                  generationJobId: "generation-script",
                  userId: "user-1",
                  stage: "teacher_script",
                  version: 1,
                  status: "completed",
                  inputHash: "sha256:script",
                  payload: scriptResponse.script,
                  isCurrent: true,
                  createdAt: "2026-08-18T00:00:00Z"
                }
              ]
            } as never
          }
          lesson={scriptResponse.lesson as never}
          onRunStage={onRunStage}
          script={scriptResponse.script as never}
        />
      );
    });

    const regenerateButton = container.querySelector('button[aria-label="Regenerate teacher_script"]');
    expect(regenerateButton).not.toBeNull();

    await act(async () => {
      regenerateButton?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
    });

    expect(onRunStage).toHaveBeenCalledWith("teacher_script", {force: true});

    await act(async () => {
      root.render(
        <LessonResult
          generation={
            {
              job: {
                id: "generation-script",
                userId: "user-1",
                equationInput: "x^2 + 5x + 6",
                status: "processing",
                creditsUsed: 0
              },
              lesson: scriptResponse.lesson,
              artifacts: [
                {
                  id: "script-artifact",
                  generationJobId: "generation-script",
                  userId: "user-1",
                  stage: "teacher_script",
                  version: 1,
                  status: "completed",
                  inputHash: "sha256:script",
                  payload: scriptResponse.script,
                  isCurrent: true,
                  createdAt: "2026-08-18T00:00:00Z"
                }
              ]
            } as never
          }
          lesson={scriptResponse.lesson as never}
          loadingStage="teacher_script"
          onRunStage={onRunStage}
          script={scriptResponse.script as never}
          scriptLoading
        />
      );
    });

    const loadingRegenerateButton = container.querySelector<HTMLButtonElement>('button[aria-label="Regenerate teacher_script"]');
    expect(loadingRegenerateButton).not.toBeNull();
    expect(loadingRegenerateButton?.disabled).toBe(true);
    expect(container.querySelectorAll('[role="status"][aria-label="Loading"]')).toHaveLength(1);

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

  it("shows a loading spinner for the specific running stage", async () => {
    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LessonResult
          lesson={scriptResponse.lesson as never}
          loadingStage="animation_plan"
          narration={
            {
              status: "completed",
              provider: "elevenlabs",
              voiceId: "male-voice",
              modelId: "eleven_multilingual_v2",
              durationSeconds: 3,
              speechText: "Factor first."
            } as never
          }
          script={scriptResponse.script as never}
        />
      );
    });

    expect(container.textContent).toContain("animation_plan");
    expect(container.querySelectorAll('[role="status"][aria-label="Loading"]')).toHaveLength(1);

    await act(async () => {
      root.unmount();
    });
  });

  it("renders manual run controls for script and narration steps", async () => {
    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onGenerateScript = vi.fn();
    const onRunStage = vi.fn();

    await act(async () => {
      root.render(
        <LessonResult
          lesson={scriptResponse.lesson as never}
          onGenerateScript={onGenerateScript}
          onRunStage={onRunStage}
        />
      );
    });

    const scriptButton = container.querySelector('button[aria-label="Run teacher_script"]');
    expect(scriptButton).not.toBeNull();
    expect(container.querySelector('button[aria-label="Run full pipeline"]')).toBeNull();

    await act(async () => {
      scriptButton?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
    });

    expect(onGenerateScript).toHaveBeenCalledOnce();

    await act(async () => {
      root.render(
        <LessonResult
          lesson={scriptResponse.lesson as never}
          onRunStage={onRunStage}
          script={scriptResponse.script as never}
        />
      );
    });

    const narrationButton = container.querySelector('button[aria-label="Run elevenlabs_request"]');
    expect(narrationButton).not.toBeNull();

    await act(async () => {
      narrationButton?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
    });

    expect(onRunStage).toHaveBeenCalledWith("elevenlabs_audio");

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
          onGenerateScript={vi.fn()}
          onRunStage={vi.fn()}
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

    expect(container.querySelector('button[aria-label="Run full pipeline"]')).toBeNull();
    expect(container.querySelector('button[aria-label="Regenerate ElevenLabs audio"]')).toBeNull();
    expect(container.querySelector('button[aria-label="Regenerate ElevenLabs audio for Factor the quadratic"]')).toBeNull();

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

  it("renders the persisted ElevenLabs request artifact instead of the completed audio payload", async () => {
    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LessonResult
          generation={
            {
              job: {
                id: "generation-request-log",
                userId: "user-1",
                equationInput: "x^2 + 5x + 6",
                status: "completed",
                creditsUsed: 0
              },
              lesson: scriptResponse.lesson,
              artifacts: [
                {
                  id: "request-artifact",
                  generationJobId: "generation-request-log",
                  userId: "user-1",
                  stage: "elevenlabs_request",
                  version: 1,
                  status: "completed",
                  inputHash: "sha256:request",
                  provider: "openai",
                  model: "speech-markup",
                  payload: {
                    status: "completed",
                    provider: "openai",
                    speechText: 'Conversational request text.<break time="0.7s" />'
                  },
                  isCurrent: true,
                  createdAt: "2026-08-19T00:00:00Z"
                },
                {
                  id: "audio-artifact",
                  generationJobId: "generation-request-log",
                  userId: "user-1",
                  stage: "elevenlabs_audio",
                  version: 1,
                  status: "completed",
                  inputHash: "sha256:audio",
                  provider: "elevenlabs",
                  model: "eleven_multilingual_v2",
                  payload: {
                    status: "completed",
                    provider: "elevenlabs",
                    voiceId: "male-voice",
                    modelId: "eleven_multilingual_v2",
                    speechText: "Completed audio payload text should not appear in the request card.",
                    segments: [
                      {
                        scriptSegmentId: "script_factor",
                        stepId: "factor",
                        title: "Factor the quadratic",
                        provider: "elevenlabs",
                        voiceId: "male-voice",
                        modelId: "eleven_multilingual_v2",
                        audioMimeType: "audio/mpeg",
                        speechText: "Completed audio segment text should not appear in the request card."
                      }
                    ]
                  },
                  isCurrent: true,
                  createdAt: "2026-08-19T00:00:01Z"
                }
              ]
            } as never
          }
          lesson={scriptResponse.lesson as never}
        />
      );
    });

    expect(container.textContent).toContain("elevenlabs_request");
    expect(container.textContent).toContain('Conversational request text.<break time="0.7s" />');
    expect(container.textContent).not.toContain("Completed audio payload text should not appear in the request card.");
    expect(container.textContent).not.toContain("Completed audio segment text should not appear in the request card.");

    await act(async () => {
      root.unmount();
    });
  });

  it("does not show a whole-audio regenerate control", async () => {
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
              unsupportedReason: "ElevenLabs payment is required.",
              speechText: 'First factor the quadratic.<break time="0.7s" />'
            } as never
          }
          script={scriptResponse.script as never}
        />
      );
    });

    expect(container.querySelector('button[aria-label="Regenerate ElevenLabs audio"]')).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it("renders segmented ElevenLabs audio without regenerate controls", async () => {
    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

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
          script={scriptResponse.script as never}
        />
      );
    });

    expect(container.textContent).toContain("Factor first.");
    expect(container.textContent).toContain("Then solve.");
    expect(container.querySelectorAll("audio")).toHaveLength(2);
    expect(container.querySelector('button[aria-label="Regenerate ElevenLabs audio for Solve each factor"]')).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it("renders animation plan, resolved timeline, and render artifacts from a generation snapshot", async () => {
    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onRunStage = vi.fn();
    const generation = {
      job: {
        id: "generation-1",
        userId: "user-1",
        equationInput: "x^2 + 5x + 6",
        normalizedEquation: "x^2 + 5*x + 6 = 0",
        status: "completed",
        creditsUsed: 0
      },
      lesson: scriptResponse.lesson,
      artifacts: [
        {
          id: "script-artifact",
          generationJobId: "generation-1",
          userId: "user-1",
          stage: "teacher_script",
          version: 1,
          status: "completed",
          inputHash: "sha256:script",
          payload: scriptResponse.script,
          isCurrent: true,
          createdAt: "2026-08-18T00:00:00Z"
        },
        {
          id: "audio-artifact",
          generationJobId: "generation-1",
          userId: "user-1",
          stage: "elevenlabs_audio",
          version: 1,
          status: "completed",
          inputHash: "sha256:audio",
          provider: "elevenlabs",
          model: "eleven_multilingual_v2",
          payload: {
            status: "completed",
            provider: "elevenlabs",
            voiceId: "male-voice",
            modelId: "eleven_multilingual_v2",
            durationSeconds: 4,
            speechText: "We need two numbers. Now factor the quadratic.",
            segments: [
              {
                scriptSegmentId: "script_factor",
                stepId: "factor",
                title: "Factor the quadratic",
                provider: "elevenlabs",
                voiceId: "male-voice",
                modelId: "eleven_multilingual_v2",
                audioMimeType: "audio/mpeg",
                durationSeconds: 4,
                speechText: "We need two numbers. Now factor the quadratic."
              }
            ]
          },
          storageObjects: [
            {
              bucket: "generated-media",
              path: "user-1/generation-1/narration/audio-artifact.mp3",
              signedUrl: "https://media.example/audio-artifact.mp3",
              contentType: "audio/mpeg",
              metadata: {scriptSegmentId: "script_factor"}
            }
          ],
          isCurrent: true,
          createdAt: "2026-08-18T00:00:01Z"
        },
        {
          id: "plan-artifact",
          generationJobId: "generation-1",
          userId: "user-1",
          stage: "animation_plan",
          version: 1,
          status: "completed",
          inputHash: "sha256:plan",
          payload: {
            version: "animation-plan/v1",
            lessonArtifactId: "lesson-artifact",
            narrationArtifactId: "audio-artifact",
            durationSeconds: 4,
            layout: {theme: "chalkboard", verticalFlow: true},
            cues: [
              {
                id: "cue-late",
                lessonStepId: "factor",
                mathLineId: "factor_line",
                trigger: {
                  type: "narration_text",
                  scriptSegmentId: "script_factor",
                  text: "We need two numbers"
                },
                visual: {
                  action: "highlight",
                  target: {lessonStepId: "factor", mathLineId: "factor_line"}
                },
                sync: {mode: "with_narration"}
              },
              {
                id: "cue-1",
                lessonStepId: "factor",
                mathLineId: "factor_line",
                trigger: {
                  type: "narration_text",
                  scriptSegmentId: "script_factor",
                  text: "Now factor the quadratic"
                },
                visual: {
                  action: "write_math",
                  target: {lessonStepId: "factor", mathLineId: "factor_line", fragment: "(x + 2)(x + 3)"}
                },
                sync: {mode: "with_narration"}
              }
            ]
          },
          isCurrent: true,
          createdAt: "2026-08-18T00:00:02Z"
        },
        {
          id: "timeline-artifact",
          generationJobId: "generation-1",
          userId: "user-1",
          stage: "resolved_timeline",
          version: 1,
          status: "completed",
          inputHash: "sha256:timeline",
          payload: {
            version: "resolved-animation-timeline/v1",
            animationPlanArtifactId: "plan-artifact",
            narrationArtifactId: "audio-artifact",
            durationSeconds: 4,
            cues: [
              {
                cueId: "cue-1",
                lessonStepId: "factor",
                mathLineId: "factor_line",
                narration: {text: "Now factor the quadratic", startSeconds: 1, endSeconds: 2.2},
                animation: {action: "write_math", startSeconds: 1.1, endSeconds: 2.1},
                sfx: {type: "chalk_write", startSeconds: 1.1, endSeconds: 2.1}
              },
              {
                cueId: "cue-late",
                lessonStepId: "factor",
                mathLineId: "factor_line",
                narration: {text: "We need two numbers", startSeconds: 3, endSeconds: 3.8},
                animation: {action: "highlight", startSeconds: 3, endSeconds: 3.8}
              }
            ]
          },
          isCurrent: true,
          createdAt: "2026-08-18T00:00:03Z"
        },
        {
          id: "video-artifact",
          generationJobId: "generation-1",
          userId: "user-1",
          stage: "base_video",
          version: 1,
          status: "completed",
          inputHash: "sha256:video",
          storageObjects: [
            {
              bucket: "generated-media",
              path: "user-1/generation-1/renders/video-artifact.mp4",
              signedUrl: "https://media.example/video-artifact.mp4",
              contentType: "video/mp4"
            }
          ],
          isCurrent: true,
          createdAt: "2026-08-18T00:00:04Z"
        }
      ]
    };

    await act(async () => {
      root.render(<LessonResult generation={generation as never} lesson={scriptResponse.lesson as never} onRunStage={onRunStage} />);
    });

    expect(container.textContent).toContain("animation_plan");
    expect(container.textContent).toContain("resolved_timeline");
    expect(container.textContent).toContain("render input");
    expect(container.textContent).toContain("Motion Canvas receives the lesson, resolved timeline, and signed narration segment URLs.");
    expect(container.textContent).toContain("motion_canvas_render");
    expect(container.textContent).toContain("Now factor the quadratic");
    expect(container.textContent).toContain("write_math -> factor_line");
    const animationPlanRows = Array.from(container.querySelectorAll("tbody tr")).map(
      (row) => row.textContent ?? ""
    );
    expect(animationPlanRows[0]).toContain("Now factor the quadratic");
    expect(animationPlanRows[1]).toContain("We need two numbers");
    expect(container.textContent).toContain("storage: generated-media/user-1/generation-1/narration/audio-artifact.mp3");
    expect(container.querySelector('audio[src="https://media.example/audio-artifact.mp3"]')).not.toBeNull();
    expect(container.textContent).toContain("Video is ready in the Lesson tab.");

    const regenerateRequest = container.querySelector('button[aria-label="Regenerate elevenlabs_request"]');
    await act(async () => {
      regenerateRequest?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
    });

    expect(onRunStage).toHaveBeenCalledWith("elevenlabs_audio", {force: true});

    const regenerateAudio = container.querySelector('button[aria-label="Regenerate elevenlabs_audio"]');
    await act(async () => {
      regenerateAudio?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
    });

    expect(onRunStage).toHaveBeenCalledWith("elevenlabs_audio", {force: true});

    const regeneratePlan = container.querySelector('button[aria-label="Regenerate animation plan"]');
    await act(async () => {
      regeneratePlan?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
    });

    expect(onRunStage).toHaveBeenCalledWith("animation_plan", {force: true});

    const openLesson = container.querySelector('button[aria-label="Open Lesson tab"]');
    await act(async () => {
      openLesson?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
    });

    expect(container.textContent).toContain("Video Solution");
    expect(container.textContent).toContain("Rendered lesson playback");
    expect(container.textContent).not.toContain("storage: generated-media/user-1/generation-1/renders/video-artifact.mp4");
    expect(container.querySelector('video[src="https://media.example/video-artifact.mp4"]')).not.toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it("shows an inline spinner beside completed stage actions while that stage is loading", async () => {
    const generation = {
      job: {
        id: "generation-loading",
        userId: "user-1",
        equationInput: "x^2 + 5x + 6",
        status: "processing",
        creditsUsed: 0
      },
      lesson: scriptResponse.lesson,
      artifacts: [
        {
          id: "audio-artifact",
          generationJobId: "generation-loading",
          userId: "user-1",
          stage: "elevenlabs_audio",
          version: 1,
          status: "completed",
          inputHash: "sha256:audio",
          payload: {
            status: "completed",
            provider: "elevenlabs",
            voiceId: "male-voice",
            modelId: "eleven_multilingual_v2",
            durationSeconds: 4,
            speechText: "Now factor the quadratic.",
            segments: [
              {
                scriptSegmentId: "script_factor",
                stepId: "factor",
                title: "Factor the quadratic",
                provider: "elevenlabs",
                voiceId: "male-voice",
                modelId: "eleven_multilingual_v2",
                audioMimeType: "audio/mpeg",
                durationSeconds: 4,
                speechText: "Now factor the quadratic."
              }
            ]
          },
          isCurrent: true,
          createdAt: "2026-08-18T00:00:01Z"
        },
        {
          id: "plan-artifact",
          generationJobId: "generation-loading",
          userId: "user-1",
          stage: "animation_plan",
          version: 1,
          status: "completed",
          inputHash: "sha256:plan",
          payload: {
            version: "animation-plan/v1",
            lessonArtifactId: "lesson-artifact",
            narrationArtifactId: "audio-artifact",
            durationSeconds: 4,
            layout: {theme: "chalkboard", verticalFlow: true},
            cues: [
              {
                id: "cue-1",
                lessonStepId: "factor",
                mathLineId: "factor_line",
                trigger: {
                  type: "narration_text",
                  scriptSegmentId: "script_factor",
                  text: "Now factor the quadratic"
                },
                visual: {
                  action: "write_math",
                  target: {lessonStepId: "factor", mathLineId: "factor_line"}
                },
                sync: {mode: "with_narration"}
              }
            ]
          },
          isCurrent: true,
          createdAt: "2026-08-18T00:00:02Z"
        },
        {
          id: "timeline-artifact",
          generationJobId: "generation-loading",
          userId: "user-1",
          stage: "resolved_timeline",
          version: 1,
          status: "completed",
          inputHash: "sha256:timeline",
          payload: {
            version: "resolved-animation-timeline/v1",
            animationPlanArtifactId: "plan-artifact",
            narrationArtifactId: "audio-artifact",
            durationSeconds: 4,
            cues: [
              {
                cueId: "cue-1",
                lessonStepId: "factor",
                mathLineId: "factor_line",
                narration: {text: "Now factor the quadratic", startSeconds: 1, endSeconds: 2.2},
                animation: {action: "write_math", startSeconds: 1.1, endSeconds: 2.1},
                sfx: {type: "chalk_write", startSeconds: 1.1, endSeconds: 2.1}
              }
            ]
          },
          isCurrent: true,
          createdAt: "2026-08-18T00:00:03Z"
        },
        {
          id: "render-artifact",
          generationJobId: "generation-loading",
          userId: "user-1",
          stage: "motion_canvas_render",
          version: 1,
          status: "completed",
          inputHash: "sha256:render",
          payload: {durationSeconds: 4},
          isCurrent: true,
          createdAt: "2026-08-18T00:00:04Z"
        }
      ]
    };

    for (const [stage, label] of [
      ["animation_plan", "Regenerate animation plan"],
      ["resolved_timeline", "Regenerate resolved timeline"],
      ["motion_canvas_render", "Regenerate Motion Canvas render"]
    ]) {
      container = document.createElement("div");
      document.body.append(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(
          <LessonResult
            generation={generation as never}
            lesson={scriptResponse.lesson as never}
            loadingStage={stage}
            onRunStage={vi.fn()}
          />
        );
      });

      const actionButton = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
      expect(actionButton).not.toBeNull();
      expect(actionButton?.disabled).toBe(true);
      expect(container.querySelectorAll('[role="status"][aria-label="Loading"]')).toHaveLength(1);

      await act(async () => {
        root.unmount();
      });
      container.remove();
      container = null;
    }

    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LessonResult
          generation={generation as never}
          lesson={scriptResponse.lesson as never}
          loadingStage="elevenlabs_audio"
          onRunStage={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain("elevenlabs_request");
    expect(container.textContent).toContain("elevenlabs_audio");
    const regenerateRequest = container.querySelector<HTMLButtonElement>('button[aria-label="Regenerate elevenlabs_request"]');
    const regenerateAudio = container.querySelector<HTMLButtonElement>('button[aria-label="Regenerate elevenlabs_audio"]');
    expect(regenerateRequest).not.toBeNull();
    expect(regenerateRequest?.disabled).toBe(true);
    expect(regenerateAudio).not.toBeNull();
    expect(regenerateAudio?.disabled).toBe(true);
    expect(container.querySelectorAll('[role="status"][aria-label="Loading"]')).toHaveLength(2);

    await act(async () => {
      root.unmount();
    });
  });

  it("shows the ElevenLabs request spinner when the request stage is running", async () => {
    const generation = {
      job: {
        id: "generation-request-loading",
        userId: "user-1",
        equationInput: "x^2 + 5x + 6",
        status: "processing",
        creditsUsed: 0
      },
      lesson: scriptResponse.lesson,
      artifacts: [
        {
          id: "request-artifact",
          generationJobId: "generation-request-loading",
          userId: "user-1",
          stage: "elevenlabs_request",
          version: 1,
          status: "completed",
          inputHash: "sha256:request",
          payload: {
            status: "completed",
            provider: "openai",
            voiceId: "male-voice",
            modelId: "speech-markup",
            durationSeconds: 4,
            speechText: "First, factor the quadratic.",
            segments: [
              {
                scriptSegmentId: "script_factor",
                stepId: "factor",
                title: "Factor the quadratic",
                provider: "openai",
                voiceId: "male-voice",
                modelId: "speech-markup",
                durationSeconds: 4,
                speechText: "First, factor the quadratic."
              }
            ]
          },
          isCurrent: true,
          createdAt: "2026-08-18T00:00:01Z"
        }
      ]
    };

    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LessonResult
          generation={generation as never}
          lesson={scriptResponse.lesson as never}
          loadingStage="elevenlabs_request"
          onRunStage={vi.fn()}
        />
      );
    });

    const regenerateRequest = container.querySelector<HTMLButtonElement>('button[aria-label="Regenerate elevenlabs_request"]');
    expect(regenerateRequest).not.toBeNull();
    expect(regenerateRequest?.disabled).toBe(true);
    expect(container.querySelectorAll('[role="status"][aria-label="Loading"]')).toHaveLength(1);

    await act(async () => {
      root.unmount();
    });
  });

  it("shows artifact last-run timestamps in 24-hour time", async () => {
    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LessonResult
          generation={
            {
              job: {
                id: "generation-timestamp",
                userId: "user-1",
                equationInput: "x^2 + 5x + 6",
                status: "processing",
                creditsUsed: 0
              },
              lesson: scriptResponse.lesson,
              artifacts: [
                {
                  id: "script-artifact",
                  generationJobId: "generation-timestamp",
                  userId: "user-1",
                  stage: "teacher_script",
                  version: 1,
                  status: "completed",
                  inputHash: "sha256:script",
                  payload: scriptResponse.script,
                  isCurrent: true,
                  createdAt: "2026-08-18T15:04:00",
                  completedAt: "2026-08-18T15:05:06"
                }
              ]
            } as never
          }
          lesson={scriptResponse.lesson as never}
          script={scriptResponse.script as never}
        />
      );
    });

    expect(container.textContent).toContain("last ran 2026-08-18");
    expect(container.textContent).toMatch(/15:05/);

    await act(async () => {
      root.unmount();
    });
  });

  it("shows a loading spinner for persisted running artifacts", async () => {
    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LessonResult
          generation={
            {
              job: {
                id: "generation-running-artifact",
                userId: "user-1",
                equationInput: "x^2 + 5x + 6",
                status: "processing",
                creditsUsed: 0
              },
              lesson: scriptResponse.lesson,
              artifacts: [
                {
                  id: "request-artifact",
                  generationJobId: "generation-running-artifact",
                  userId: "user-1",
                  stage: "elevenlabs_request",
                  version: 2,
                  status: "running",
                  inputHash: "sha256:request",
                  payload: {
                    status: "completed",
                    provider: "openai",
                    voiceId: "male-voice",
                    modelId: "speech-markup",
                    durationSeconds: 4,
                    speechText: "First, factor the quadratic."
                  },
                  isCurrent: true,
                  createdAt: "2026-08-18T15:04:00Z"
                }
              ]
            } as never
          }
          lesson={scriptResponse.lesson as never}
          onRunStage={vi.fn()}
        />
      );
    });

    const regenerateRequest = container.querySelector<HTMLButtonElement>('button[aria-label="Regenerate elevenlabs_request"]');
    expect(regenerateRequest).not.toBeNull();
    expect(regenerateRequest?.disabled).toBe(true);
    expect(container.querySelectorAll('[role="status"][aria-label="Loading"]')).toHaveLength(1);

    await act(async () => {
      root.unmount();
    });
  });

  it("keeps stale animation artifacts visible", async () => {
    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LessonResult
          generation={
            {
              job: {
                id: "generation-2",
                userId: "user-1",
                equationInput: "x^2 + 5x + 6",
                status: "processing",
                creditsUsed: 0
              },
              lesson: scriptResponse.lesson,
              artifacts: [
                {
                  id: "stale-plan",
                  generationJobId: "generation-2",
                  userId: "user-1",
                  stage: "animation_plan",
                  version: 1,
                  status: "stale",
                  inputHash: "sha256:old-plan",
                  staleReason: "Narration was regenerated after this animation plan was created.",
                  payload: {
                    version: "animation-plan/v1",
                    lessonArtifactId: "lesson-artifact",
                    narrationArtifactId: "old-audio",
                    layout: {theme: "chalkboard", verticalFlow: true},
                    cues: [
                      {
                        id: "cue-old",
                        lessonStepId: "factor",
                        trigger: {
                          type: "narration_text",
                          scriptSegmentId: "script_factor",
                          text: "old narration phrase"
                        },
                        visual: {action: "highlight", target: {lessonStepId: "factor"}},
                        sync: {mode: "with_narration"}
                      }
                    ]
                  },
                  isCurrent: false,
                  createdAt: "2026-08-18T00:00:00Z"
                }
              ]
            } as never
          }
          lesson={scriptResponse.lesson as never}
        />
      );
    });

    expect(container.textContent).toContain("animation_plan");
    expect(container.textContent).toContain("STALE");
    expect(container.textContent).toContain("Narration was regenerated after this animation plan was created.");
    expect(container.textContent).toContain("old narration phrase");

    await act(async () => {
      root.unmount();
    });
  });

  it("shows failed animation plan artifacts without crashing", async () => {
    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onRunStage = vi.fn();

    await act(async () => {
      root.render(
        <LessonResult
          generation={
            {
              job: {
                id: "generation-3",
                userId: "user-1",
                equationInput: "x^2 + 5x + 6",
                status: "completed",
                creditsUsed: 0
              },
              lesson: scriptResponse.lesson,
              artifacts: [
                {
                  id: "audio-artifact",
                  generationJobId: "generation-3",
                  userId: "user-1",
                  stage: "elevenlabs_audio",
                  version: 1,
                  status: "completed",
                  inputHash: "sha256:audio",
                  payload: {
                    status: "completed",
                    provider: "elevenlabs",
                    voiceId: "male-voice",
                    modelId: "eleven_multilingual_v2",
                    durationSeconds: 4,
                    speechText: "We need two numbers."
                  },
                  isCurrent: true,
                  createdAt: "2026-08-18T00:00:01Z"
                },
                {
                  id: "failed-plan",
                  generationJobId: "generation-3",
                  userId: "user-1",
                  stage: "animation_plan",
                  version: 1,
                  status: "failed",
                  inputHash: "sha256:plan",
                  errorCode: "animation_plan_failed",
                  errorMessage: "planner exploded",
                  payload: {},
                  isCurrent: false,
                  createdAt: "2026-08-18T00:00:02Z"
                }
              ]
            } as never
          }
          lesson={scriptResponse.lesson as never}
          onRunStage={onRunStage}
        />
      );
    });

    expect(container.textContent).toContain("animation_plan");
    expect(container.textContent).toContain("FAILED");
    expect(container.textContent).toContain("planner exploded");
    expect(container.querySelector('button[aria-label="Run animation_plan"]')).not.toBeNull();

    await act(async () => {
      root.unmount();
    });
  });
});
