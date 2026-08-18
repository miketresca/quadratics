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
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Solve a quadratic</h1>
          <p className="mt-1 text-sm text-neutral-700">v0 supports factoring lessons for clean rational quadratics.</p>
        </div>
        <CreditBalance balance={user?.creditBalance ?? null} />
      </div>

      <form action={onSubmit} className="mt-8 grid gap-4 rounded border border-neutral-300 bg-white p-4">
        <label className="grid gap-2">
          <span className="text-sm font-medium">Equation</span>
          <input
            className="rounded border border-neutral-400 px-3 py-2 font-mono"
            name="equation"
            defaultValue="2*x^2 - 7*x + 3 = 0"
            required
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium">Instructor</span>
          <select className="rounded border border-neutral-400 px-3 py-2" name="instructorId" defaultValue="male">
            {instructors.map((instructor) => (
              <option key={instructor.id} value={instructor.id}>
                {instructor.displayName}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-3">
          <button className="rounded bg-emerald-700 px-4 py-2 font-medium text-white disabled:opacity-60" disabled={disabled}>
            {disabled ? "Solving..." : "Solve"}
          </button>
          <button className="rounded border border-neutral-500 px-4 py-2" type="reset" disabled={disabled} onClick={() => setViewState({kind: "idle"})}>
            Reset
          </button>
        </div>
      </form>

      {viewState.kind === "submitting" ? <p className="mt-4 text-sm" role="status">Solving equation...</p> : null}
      {viewState.kind === "error" ? (
        <p className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800" ref={errorRef} role="alert" tabIndex={-1}>
          {viewState.message}
        </p>
      ) : null}
      {lesson ? <LessonResult lesson={lesson} /> : null}
    </div>
  );
}
