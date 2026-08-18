"use client";

import {instructors} from "@quadratics/config";
import type {CurrentUser, Lesson} from "@quadratics/types";
import {useRef, useState, useTransition} from "react";

import {CreditBalance} from "@/components/credit-balance";
import {LessonResult} from "@/components/lesson-result";
import {getMe, solveEquation} from "@/lib/api";
import {stateForLesson, type SolveViewState} from "@/lib/lesson-view";
import {createClient} from "@/lib/supabase/client";

export function EquationForm({initialUser}: {initialUser: CurrentUser | null}) {
  const [user, setUser] = useState(initialUser);
  const [viewState, setViewState] = useState<SolveViewState>({kind: "idle"});
  const [isPending, startTransition] = useTransition();
  const errorRef = useRef<HTMLParagraphElement>(null);

  async function refreshUser(accessToken: string) {
    try {
      setUser(await getMe(accessToken));
    } catch {
      setUser(initialUser);
    }
  }

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const equation = String(formData.get("equation") ?? "");
      const instructorId = String(formData.get("instructorId") ?? "male");
      setViewState({kind: "submitting"});

      try {
        const supabase = createClient();
        const {
          data: {session}
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error("Your session expired. Sign in again.");
        }
        const lesson = await solveEquation({accessToken: session.access_token, equation, instructorId});
        setViewState(stateForLesson(lesson as Lesson));
        await refreshUser(session.access_token);
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
        <div className="mb-4 flex items-center justify-between">
          <div className="font-mono text-sm text-emerald-300">quadratic_input</div>
          <CreditBalance balance={user?.creditBalance ?? null} />
        </div>

        <form action={onSubmit} className="grid gap-4">
          <div className="flex min-h-16 items-center rounded border border-zinc-700 bg-[#101621] focus-within:border-emerald-400">
            <label className="sr-only" htmlFor="equation">
              Equation
            </label>
            <input
              className="min-w-0 flex-1 bg-transparent px-4 py-4 font-mono text-lg text-zinc-100 outline-none placeholder:text-zinc-500 sm:px-5 sm:text-xl"
              id="equation"
              name="equation"
              placeholder="2*x^2 - 7*x + 3 = 0"
              defaultValue="2*x^2 - 7*x + 3 = 0"
              required
            />
            <button
              className="mr-2 flex h-11 w-11 items-center justify-center rounded border border-zinc-700 bg-zinc-900 text-xl text-zinc-200 hover:border-emerald-400 hover:text-white disabled:opacity-50"
              disabled={disabled}
              aria-label={disabled ? "Solving" : "Solve equation"}
            >
              {disabled ? "..." : "->"}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
            <label className="grid gap-1 text-xs uppercase tracking-wide text-zinc-500">
              <span>Instructor</span>
              <select
                className="h-12 rounded border border-zinc-700 bg-[#101621] px-3 text-sm normal-case tracking-normal text-zinc-100 outline-none focus:border-emerald-400"
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

            <label className="flex h-12 items-center justify-between gap-3 rounded border border-zinc-700 bg-[#101621] px-3 text-sm text-zinc-200">
              <span>Video</span>
              <input className="peer sr-only" name="videoEnabled" type="checkbox" defaultChecked />
              <span className="relative h-6 w-11 rounded-full bg-zinc-700 transition after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:bg-emerald-500 peer-checked:after:translate-x-5" />
            </label>

            <button
              className="h-12 rounded border border-zinc-700 px-4 text-sm text-zinc-300 hover:border-zinc-500 hover:text-white disabled:opacity-50"
              type="reset"
              disabled={disabled}
              onClick={() => setViewState({kind: "idle"})}
            >
              Reset
            </button>
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
