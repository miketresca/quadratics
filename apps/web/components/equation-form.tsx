"use client";

import {instructors} from "@quadratics/config";
import type {CurrentUser, Lesson, OutputMode} from "@quadratics/types";
import {useRef, useState, useTransition} from "react";

import {LessonResult} from "@/components/lesson-result";
import {MathEquationInput} from "@/components/math-equation-input";
import {generateEquationScript} from "@/lib/api";
import {devAuthBypass} from "@/lib/env";
import {stateForLesson, type SolveViewState} from "@/lib/lesson-view";
import {createClient} from "@/lib/supabase/client";

const sampleEquations = ["x^2 + 5x + 6", "2x^2 - 7x + 3", "x^2 - x"];

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
      if (process.env.NODE_ENV === "development" || devAuthBypass) {
        console.info("[quadratics] submitting equation", {equation, instructorId, outputMode});
      }

      try {
        let accessToken = "dev";
        if (!devAuthBypass) {
          const supabase = createClient();
          const {
            data: {session}
          } = await supabase.auth.getSession();
          if (!session?.access_token) {
            throw new Error("Your session expired. Sign in again.");
          }
          accessToken = session.access_token;
        }
        const response = await generateEquationScript({accessToken, equation, instructorId, outputMode});
        const {lesson, script} = response;
        if (process.env.NODE_ENV === "development" || devAuthBypass) {
          const lineCount = lesson.steps.reduce((count, step) => count + step.mathLines.length, 0);
          console.info("[quadratics] received lesson", {
            status: lesson.status,
            method: lesson.method,
            lineCount
          });
          console.info("[quadratics] received script", script);
        }
        setViewState(stateForLesson(lesson as Lesson, script));
      } catch (error) {
        setViewState({kind: "error", message: error instanceof Error ? error.message : "Could not solve the equation"});
        setTimeout(() => errorRef.current?.focus(), 0);
      }
    });
  }

  const disabled = isPending || viewState.kind === "submitting";
  const lesson = viewState.kind === "success" || viewState.kind === "unsupported" ? viewState.lesson : null;
  const script = viewState.kind === "success" || viewState.kind === "unsupported" ? viewState.script : undefined;

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-3xl rounded-md border border-zinc-800/90 bg-[#080c12]/90 p-4 shadow-2xl shadow-black/40 backdrop-blur sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="font-mono text-sm text-emerald-300">quadratic_input</div>
          <div className="hidden font-mono text-xs text-zinc-600 sm:block">sympy {"->"} script</div>
        </div>

        <form action={onSubmit} className="grid gap-4">
          <div className="flex min-h-16 items-center rounded-md border border-zinc-700/90 bg-[#101621] focus-within:border-emerald-400/80">
            <label className="sr-only" htmlFor="equation">
              Equation
            </label>
            <MathEquationInput
              disabled={disabled}
              value={equationValue}
              onEquationChange={(visibleValue) => setEquationValue(visibleValue)}
            />
            <button
              className="mr-2 flex h-11 w-11 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 font-mono text-xl text-zinc-200 hover:border-emerald-400 hover:text-white disabled:opacity-50"
              disabled={disabled}
              aria-label={disabled ? "Solving" : "Solve equation"}
            >
              {disabled ? "..." : "->"}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-zinc-500">
            <span className="mr-1 uppercase tracking-wide">try</span>
            {sampleEquations.map((sample) => (
              <button
                className="rounded-md border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-left text-zinc-300 hover:border-sky-400/70 hover:text-white"
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
            <label className="flex min-h-11 flex-1 items-center gap-3 rounded-md border border-transparent px-3 text-sm text-zinc-500 focus-within:border-emerald-400/70">
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
                  <span className="flex h-8 items-center justify-center border border-zinc-800 bg-zinc-950/50 px-2 text-zinc-400 transition peer-checked:border-sky-400/70 peer-checked:bg-sky-400/10 peer-checked:text-zinc-100">
                    Video + audio
                  </span>
                </label>
                <label className="cursor-pointer overflow-hidden rounded-md">
                  <input className="peer sr-only" name="outputMode" type="radio" value="audio" />
                  <span className="flex h-8 items-center justify-center border border-zinc-800 bg-zinc-950/50 px-2 text-zinc-400 transition peer-checked:border-sky-400/70 peer-checked:bg-sky-400/10 peer-checked:text-zinc-100">
                    Audio only
                  </span>
                </label>
              </span>
            </fieldset>
          </div>
        </form>
      </div>

      {viewState.kind === "submitting" ? (
        <p className="mx-auto mt-4 max-w-3xl font-mono text-sm text-zinc-400" role="status">
          solving...
        </p>
      ) : null}
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
      {lesson ? <LessonResult lesson={lesson} script={script} /> : null}
    </div>
  );
}
