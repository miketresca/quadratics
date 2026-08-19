"use client";

import {instructors} from "@quadratics/config";
import type {CurrentUser, Lesson} from "@quadratics/types";
import {useRef, useState, useTransition} from "react";

import {LessonResult} from "@/components/lesson-result";
import {MathEquationInput} from "@/components/math-equation-input";
import {
  createGeneration,
  runGenerationStage
} from "@/lib/api";
import {stateForLesson, type SolveViewState} from "@/lib/lesson-view";
import {createClient} from "@/lib/supabase/client";

const sampleEquations = ["x^2 + 5x + 6", "2x^2 - 7x + 3", "x^2 - x"];
const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function EquationForm({initialUser: _initialUser}: {initialUser: CurrentUser | null}) {
  const [viewState, setViewState] = useState<SolveViewState>({kind: "idle"});
  const [equationValue, setEquationValue] = useState("");
  const [activePipelineStage, setActivePipelineStage] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const errorRef = useRef<HTMLParagraphElement>(null);
  const pipelineInFlightRef = useRef(false);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const equation = String(formData.get("equation") ?? "");
      const instructorId = String(formData.get("instructorId") ?? "male");
      setViewState({kind: "submitting"});
      if (process.env.NODE_ENV === "development") {
        console.info("[quadratics] submitting equation", {equation, instructorId});
      }

      try {
        if (!supabaseConfigured) {
          throw new Error("Sign in to run an equation.");
        }
        const supabase = createClient();
        const {
          data: {session}
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error("Sign in to run an equation.");
        }
        const accessToken = session.access_token;
        const generation = await createGeneration({accessToken, equation, instructorId});
        const lesson = generation.lesson as Lesson;
        if (process.env.NODE_ENV === "development") {
          const lineCount = lesson.steps.reduce((count, step) => count + step.mathLines.length, 0);
          console.info("[quadratics] received lesson", {
            status: lesson.status,
            method: lesson.method,
            lineCount
          });
        }
        setViewState(stateForLesson(lesson, undefined, undefined, generation));
      } catch (error) {
        setViewState({kind: "error", message: error instanceof Error ? error.message : "Could not solve the equation"});
        setTimeout(() => errorRef.current?.focus(), 0);
      }
    });
  }

  function startPipelineOperation(stage: string) {
    if (pipelineInFlightRef.current || viewState.kind === "submitting") {
      return false;
    }
    pipelineInFlightRef.current = true;
    setActivePipelineStage(stage);
    return true;
  }

  function finishPipelineOperation() {
    pipelineInFlightRef.current = false;
    setActivePipelineStage(undefined);
  }

  function runScript() {
    if (!lesson || !startPipelineOperation("teacher_script")) {
      return;
    }

    startTransition(async () => {
      setViewState({kind: "submitting", lesson, generation, scriptLoading: true});
      try {
        if (!supabaseConfigured) {
          throw new Error("Sign in to generate the teacher script.");
        }
        const accessToken = await getAccessToken();
        if (!generation) {
          throw new Error("Solve the equation before generating the teacher script.");
        }
        const response = await runGenerationStage({
          accessToken,
          generationId: generation.job.id,
          stage: "teacher_script"
        });
        setViewState(stateForLesson(response.lesson as Lesson, undefined, undefined, response));
      } catch (scriptError) {
        if (process.env.NODE_ENV === "development") {
          console.error("[quadratics] script generation failed", scriptError);
        }
        setViewState(stateForLesson(lesson, script, narration, generation));
      } finally {
        finishPipelineOperation();
      }
    });
  }

  const disabled = isPending || viewState.kind === "submitting" || Boolean(activePipelineStage);
  const lesson =
    viewState.kind === "success" || viewState.kind === "unsupported" || viewState.kind === "submitting"
      ? viewState.lesson
      : null;
  const script =
    viewState.kind === "success" || viewState.kind === "unsupported" || viewState.kind === "submitting"
      ? viewState.script
      : undefined;
  const narration =
    viewState.kind === "success" || viewState.kind === "unsupported" || viewState.kind === "submitting"
      ? viewState.narration
      : undefined;
  const generation =
    viewState.kind === "success" || viewState.kind === "unsupported" || viewState.kind === "submitting"
      ? viewState.generation
      : undefined;
  const loadingStage = activePipelineStage ?? (viewState.kind === "submitting" ? viewState.loadingStage : undefined);
  const scriptLoading =
    viewState.kind === "submitting" &&
    (viewState.scriptLoading === true || loadingStage === "teacher_script");
  const speechMarkupLoading =
    viewState.kind === "submitting" &&
    (viewState.speechMarkupLoading === true || loadingStage === "elevenlabs_request" || loadingStage === "elevenlabs_audio");
  const narrationLoading =
    viewState.kind === "submitting" &&
    viewState.narrationLoading === true;

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-3xl rounded-md border border-zinc-800/90 bg-[#080c12]/90 p-4 shadow-2xl shadow-black/40 backdrop-blur sm:p-5">
        <form action={onSubmit} className="grid gap-4">
          <div className="flex min-h-16 items-center rounded-md border border-zinc-700/90 bg-[#101621]">
            <label className="sr-only" htmlFor="equation">
              Equation
            </label>
            <MathEquationInput
              disabled={disabled}
              value={equationValue}
              onEquationChange={(visibleValue) => setEquationValue(visibleValue)}
            />
            <button
              className="group/submit mr-2 flex h-11 w-11 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 text-zinc-200 transition enabled:hover:border-emerald-400 enabled:hover:bg-emerald-400/10 enabled:hover:text-emerald-300 disabled:opacity-50"
              disabled={disabled}
              aria-label={disabled ? "Solving" : "Solve equation"}
            >
              {disabled ? <LoadingDots /> : <EnterIcon />}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-zinc-500">
            <span className="mr-1 uppercase tracking-wide">try</span>
            {sampleEquations.map((sample) => (
              <button
                className="rounded-md border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-left text-zinc-300 transition enabled:hover:border-emerald-400/70 enabled:hover:bg-emerald-400/10 enabled:hover:text-emerald-300"
                disabled={disabled}
                key={sample}
                onClick={() => setEquationValue(sample)}
                type="button"
              >
                {sample}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 rounded-md border border-zinc-800 bg-zinc-950/25 p-2 sm:flex-row sm:items-center">
            <label className="flex min-h-11 flex-1 items-center gap-3 rounded-md border border-transparent px-3 text-sm text-zinc-500">
              <span className="font-mono text-xs uppercase tracking-wide">Instructor</span>
              <select className="min-w-0 flex-1 bg-transparent text-zinc-100 outline-none" name="instructorId" defaultValue="male">
                {instructors.map((instructor) => (
                  <option key={instructor.id} value={instructor.id}>
                    {instructor.displayName}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="flex min-h-11 flex-1 items-center gap-3 rounded-md border border-transparent px-3">
              <legend className="sr-only">Output mode</legend>
              <span className="font-mono text-xs uppercase tracking-wide text-zinc-500">Output</span>
              <span className="grid flex-1 grid-cols-2 gap-1 text-sm text-zinc-100">
                <label className="cursor-pointer overflow-hidden rounded-md">
                  <input className="peer sr-only" name="outputMode" type="radio" value="audio" defaultChecked />
                  <span className="flex h-8 items-center justify-center border border-zinc-800 bg-zinc-950/50 px-2 text-zinc-400 transition peer-checked:text-emerald-300">
                    Audio only
                  </span>
                </label>
                <label className="group/avatar relative cursor-not-allowed overflow-visible rounded-md">
                  <input className="peer sr-only" disabled name="outputMode" type="radio" value="video_audio" />
                  <span className="flex h-8 items-center justify-center gap-1 border border-zinc-800 bg-zinc-950/50 px-2 text-zinc-600 transition">
                    AI Avatar
                    <span className="inline-flex h-5 w-5 items-center justify-center text-zinc-500">
                      <InfoIcon />
                    </span>
                  </span>
                  <span
                    className="pointer-events-none absolute right-0 top-10 z-20 hidden w-72 rounded-md border border-zinc-700 bg-[#101621] p-3 text-left text-sm leading-6 text-zinc-200 shadow-2xl shadow-black/50 group-hover/avatar:block"
                    id="avatar-api-key-help"
                    role="tooltip"
                  >
                    For AI avatar generations, add your HeyGen API key from the account menu. Open your profile in the top right,
                    choose API keys, then paste the key from your HeyGen dashboard.
                  </span>
                </label>
              </span>
            </fieldset>

          </div>
        </form>
      </div>

      {viewState.kind === "submitting" && !lesson ? <LessonResult lesson={null} scriptLoading={scriptLoading} /> : null}
      {viewState.kind === "error" ? (
        <p
          className="mx-auto mt-4 max-w-3xl rounded border border-red-500/50 bg-red-950/40 p-3 text-sm text-red-100"
          ref={errorRef}
          role="alert"
          tabIndex={-1}
        >
          {viewState.message}
        </p>
      ) : null}
      {lesson ? (
        <LessonResult
          lesson={lesson}
          narration={narration}
          generation={generation}
          actionDisabled={disabled}
          narrationLoading={narrationLoading}
          loadingStage={loadingStage}
          onGenerateScript={runScript}
          onRunStage={(stage, options) => runStage(stage, options)}
          speechMarkupLoading={speechMarkupLoading}
          script={script}
          scriptLoading={scriptLoading}
        />
      ) : null}
    </div>
  );

  function runStage(stage: string, options: {force?: boolean} = {}) {
    if (!lesson || !generation || !startPipelineOperation(stage)) {
      return;
    }
    startTransition(async () => {
      setViewState({kind: "submitting", lesson, script, narration, generation, loadingStage: stage});
      try {
        const accessToken = await getAccessToken();
        const nextGeneration = await runGenerationStage({
          accessToken,
          generationId: generation.job.id,
          stage,
          force: options.force
        });
        setViewState(stateForLesson(nextGeneration.lesson as Lesson, undefined, undefined, nextGeneration));
      } catch (stageError) {
        if (process.env.NODE_ENV === "development") {
          console.error("[quadratics] stage failed", stage, stageError);
        }
        setViewState(stateForLesson(lesson, script, narration, generation));
      } finally {
        finishPipelineOperation();
      }
    });
  }
}

async function getAccessToken() {
  const supabase = createClient();
  const {
    data: {session}
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Sign in to run an equation.");
  }
  return session.access_token;
}

function EnterIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M20 4v7a4 4 0 0 1-4 4H5" />
      <path d="m9 11-4 4 4 4" />
    </svg>
  );
}

function LoadingDots() {
  return (
    <span className="flex h-5 items-end gap-0.5" aria-label="Loading">
      <span className="h-1 w-1 animate-bounce rounded-full bg-emerald-300 [animation-delay:-0.2s]" />
      <span className="h-1 w-1 animate-bounce rounded-full bg-emerald-300 [animation-delay:-0.1s]" />
      <span className="h-1 w-1 animate-bounce rounded-full bg-emerald-300" />
    </span>
  );
}

function InfoIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10.5v5" strokeLinecap="round" />
      <path d="M12 7.5h.01" strokeLinecap="round" />
    </svg>
  );
}
