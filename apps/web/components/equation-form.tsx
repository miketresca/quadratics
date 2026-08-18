"use client";

import {instructors} from "@quadratics/config";
import type {CurrentUser, Lesson, OutputMode} from "@quadratics/types";
import {useRef, useState, useTransition} from "react";

import {LessonResult} from "@/components/lesson-result";
import {MathEquationInput} from "@/components/math-equation-input";
import {generateEquationScript, solveEquation} from "@/lib/api";
import {stateForLesson, type SolveViewState} from "@/lib/lesson-view";
import {createClient} from "@/lib/supabase/client";

const sampleEquations = ["x^2 + 5x + 6", "2x^2 - 7x + 3", "x^2 - x"];
const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function EquationForm({initialUser: _initialUser}: {initialUser: CurrentUser | null}) {
  const [viewState, setViewState] = useState<SolveViewState>({kind: "idle"});
  const [equationValue, setEquationValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const errorRef = useRef<HTMLParagraphElement>(null);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const equation = String(formData.get("equation") ?? "");
      const instructorId = String(formData.get("instructorId") ?? "male");
      const outputMode = String(formData.get("outputMode") ?? "video_audio") as OutputMode;
      setViewState({kind: "submitting"});
      if (process.env.NODE_ENV === "development") {
        console.info("[quadratics] submitting equation", {equation, instructorId, outputMode});
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
        const lessonResponse = await solveEquation({accessToken, equation, instructorId});
        const lesson = lessonResponse as Lesson;
        if (process.env.NODE_ENV === "development") {
          const lineCount = lesson.steps.reduce((count, step) => count + step.mathLines.length, 0);
          console.info("[quadratics] received lesson", {
            status: lesson.status,
            method: lesson.method,
            lineCount
          });
        }
        setViewState({kind: "submitting", lesson, scriptLoading: true});
        try {
          const response = await generateEquationScript({accessToken, equation, instructorId, outputMode});
          const {lesson: scriptedLesson, script} = response;
          if (process.env.NODE_ENV === "development") {
            console.info("[quadratics] received script", script);
          }
          setViewState(stateForLesson(scriptedLesson as Lesson, script));
        } catch (scriptError) {
          if (process.env.NODE_ENV === "development") {
            console.error("[quadratics] script generation failed", scriptError);
          }
          setViewState(stateForLesson(lesson));
        }
      } catch (error) {
        setViewState({kind: "error", message: error instanceof Error ? error.message : "Could not solve the equation"});
        setTimeout(() => errorRef.current?.focus(), 0);
      }
    });
  }

  const disabled = isPending || viewState.kind === "submitting";
  const lesson =
    viewState.kind === "success" || viewState.kind === "unsupported" || viewState.kind === "submitting"
      ? viewState.lesson
      : null;
  const script =
    viewState.kind === "success" || viewState.kind === "unsupported" || viewState.kind === "submitting"
      ? viewState.script
      : undefined;
  const scriptLoading = viewState.kind === "submitting" && viewState.scriptLoading === true;

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-3xl rounded-md border border-zinc-800/90 bg-[#080c12]/90 p-4 shadow-2xl shadow-black/40 backdrop-blur sm:p-5">
        <div className="mb-4 flex items-center gap-4">
          <div className="group relative">
            <button
              aria-describedby="avatar-api-key-help"
              aria-label="AI avatar setup information"
              className="flex h-7 w-7 items-center justify-center rounded border border-zinc-800 bg-zinc-950/50 text-zinc-500 transition hover:border-emerald-400/60 hover:text-emerald-300"
              type="button"
            >
              <InfoIcon />
            </button>
            <div
              className="pointer-events-none absolute bottom-9 left-0 z-20 hidden w-72 rounded-md border border-zinc-700 bg-[#101621] p-3 text-sm leading-6 text-zinc-200 shadow-2xl shadow-black/50 group-hover:block"
              id="avatar-api-key-help"
              role="tooltip"
            >
              For AI avatar generations, add your HeyGen API key from the account menu. Open your profile in the top right,
              choose API keys, then paste the key from your HeyGen dashboard.
            </div>
          </div>
        </div>

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
              className="group/submit mr-2 flex h-11 w-11 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-emerald-400 hover:text-emerald-300 disabled:opacity-50"
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
                className="rounded-md border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-left text-zinc-300 hover:border-emerald-400/70 hover:text-emerald-300"
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
                  <input className="peer sr-only" name="outputMode" type="radio" value="video_audio" defaultChecked />
                  <span className="flex h-8 items-center justify-center border border-zinc-800 bg-zinc-950/50 px-2 text-zinc-400 transition peer-checked:text-emerald-300">
                    AI Avatar
                  </span>
                </label>
                <label className="cursor-pointer overflow-hidden rounded-md">
                  <input className="peer sr-only" name="outputMode" type="radio" value="audio" />
                  <span className="flex h-8 items-center justify-center border border-zinc-800 bg-zinc-950/50 px-2 text-zinc-400 transition peer-checked:text-emerald-300">
                    Audio only
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
      {lesson ? <LessonResult lesson={lesson} script={script} scriptLoading={scriptLoading} /> : null}
    </div>
  );
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
  return <span className="font-mono text-zinc-500">...</span>;
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
