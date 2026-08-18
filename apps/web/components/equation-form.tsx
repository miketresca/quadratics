"use client";

import {instructors} from "@quadratics/config";
import type {CurrentUser, Lesson} from "@quadratics/types";
import {useRef, useState, useTransition} from "react";

import {LessonResult} from "@/components/lesson-result";
import {MathEquationInput} from "@/components/math-equation-input";
import {solveEquation} from "@/lib/api";
import {devAuthBypass} from "@/lib/env";
import {stateForLesson, type SolveViewState} from "@/lib/lesson-view";
import {createClient} from "@/lib/supabase/client";

export function EquationForm({initialUser: _initialUser}: {initialUser: CurrentUser | null}) {
  const [viewState, setViewState] = useState<SolveViewState>({kind: "idle"});
  const [equationValue, setEquationValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const errorRef = useRef<HTMLParagraphElement>(null);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const equation = String(formData.get("equation") ?? "");
      const instructorId = String(formData.get("instructorId") ?? "male");
      setViewState({kind: "submitting"});
      if (process.env.NODE_ENV === "development" || devAuthBypass) {
        console.info("[quadratics] submitting equation", {equation, instructorId});
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
        const lesson = await solveEquation({accessToken, equation, instructorId});
        if (process.env.NODE_ENV === "development" || devAuthBypass) {
          const lineCount = lesson.steps.reduce((count, step) => count + step.mathLines.length, 0);
          console.info("[quadratics] received lesson", {
            status: lesson.status,
            method: lesson.method,
            lineCount
          });
        }
        setViewState(stateForLesson(lesson as Lesson));
      } catch (error) {
        setViewState({kind: "error", message: error instanceof Error ? error.message : "Could not solve the equation"});
        setTimeout(() => errorRef.current?.focus(), 0);
      }
    });
  }

  const disabled = isPending || viewState.kind === "submitting";
  const lesson = viewState.kind === "success" || viewState.kind === "unsupported" ? viewState.lesson : null;

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-3xl rounded border border-zinc-700/80 bg-zinc-950/55 p-4 shadow-2xl shadow-black/40 backdrop-blur sm:p-5">
        <div className="mb-4 flex items-center">
          <div className="font-mono text-sm text-emerald-300">quadratic's tutor</div>
        </div>

        <form action={onSubmit} className="grid gap-4">
          <div className="flex min-h-16 items-center rounded border border-zinc-700 bg-[#101621] focus-within:border-emerald-400">
            <label className="sr-only" htmlFor="equation">
              Equation
            </label>
            <MathEquationInput
              disabled={disabled}
              value={equationValue}
              onEquationChange={(visibleValue) => setEquationValue(visibleValue)}
            />
            <button
              className="mr-2 flex h-11 w-11 items-center justify-center rounded border border-zinc-700 bg-zinc-900 text-xl text-zinc-200 hover:border-emerald-400 hover:text-white disabled:opacity-50"
              disabled={disabled}
              aria-label={disabled ? "Solving" : "Solve equation"}
            >
              {disabled ? "..." : "->"}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid h-20 gap-2 rounded border border-zinc-700 bg-[#101621] px-4 py-3 text-xs uppercase tracking-wide text-zinc-500 focus-within:border-emerald-400">
              <span>Instructor</span>
              <select
                className="-mx-1 h-8 bg-transparent px-1 text-sm normal-case tracking-normal text-zinc-100 outline-none"
                name="instructorId"
                defaultValue="male"
              >
                {instructors.map((instructor) => (
                  <option key={instructor.id} value={instructor.id}>
                    {instructor.displayName}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="grid h-20 gap-2 rounded border border-zinc-700 bg-[#101621] px-4 py-3 text-xs uppercase tracking-wide text-zinc-500">
              <legend className="sr-only">Output mode</legend>
              <span>Output</span>
              <span className="grid grid-cols-2 gap-2 text-sm normal-case tracking-normal text-zinc-100">
                <label className="cursor-pointer">
                  <input className="peer sr-only" name="outputMode" type="radio" value="video_audio" defaultChecked />
                  <span className="flex h-8 items-center justify-center rounded border border-zinc-700 bg-zinc-950/40 px-2 text-zinc-300 transition peer-checked:border-emerald-400/70 peer-checked:bg-emerald-400/10 peer-checked:text-zinc-100">
                    Video + audio
                  </span>
                </label>
                <label className="cursor-pointer">
                  <input className="peer sr-only" name="outputMode" type="radio" value="audio" />
                  <span className="flex h-8 items-center justify-center rounded border border-zinc-700 bg-zinc-950/40 px-2 text-zinc-300 transition peer-checked:border-emerald-400/70 peer-checked:bg-emerald-400/10 peer-checked:text-zinc-100">
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
      {lesson ? <LessonResult lesson={lesson} /> : null}
    </div>
  );
}
