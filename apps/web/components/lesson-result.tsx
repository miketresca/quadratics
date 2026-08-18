import type {Lesson} from "@quadratics/types";

import {flattenLessonMathLines} from "@/lib/lesson-view";

export function LessonResult({lesson}: {lesson: Lesson}) {
  const solutionLines = flattenLessonMathLines(lesson);

  return (
    <section className="mx-auto mt-6 max-w-3xl" aria-live="polite">
      <div className="rounded border border-zinc-700/80 bg-zinc-950/55 p-4 backdrop-blur">
        <h2 className="font-mono text-lg text-zinc-100">answer</h2>
        <dl className="mt-4 grid gap-3 text-sm text-zinc-300 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Normalized equation</dt>
            <dd className="font-mono text-zinc-100">{lesson.normalizedEquation}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Method</dt>
            <dd>{lesson.method ?? "Unsupported for v0 lessons"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Coefficients</dt>
            <dd>
              a={lesson.coefficients.a.expression}, b={lesson.coefficients.b.expression}, c=
              {lesson.coefficients.c.expression}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Roots</dt>
            <dd className="font-mono text-emerald-300">
              {lesson.solutions.map((solution) => solution.expression).join(", ")}
            </dd>
          </div>
        </dl>
        {lesson.unsupportedReason ? (
          <p className="mt-4 rounded border border-amber-500/50 bg-amber-950/40 p-3 text-sm text-amber-100">
            {lesson.unsupportedReason}
          </p>
        ) : null}
      </div>

      {solutionLines.length > 0 ? (
        <div className="mt-6 rounded border border-emerald-400/35 bg-emerald-950/10 p-4">
          <h3 className="font-mono text-sm uppercase tracking-wide text-emerald-300">solution_lines</h3>
          <ol className="mt-4 grid gap-2 font-mono text-sm text-zinc-100">
            {solutionLines.map((line, index) => (
              <li className="flex gap-3" key={`${line.id}-${index}`}>
                <span className="select-none text-zinc-500">{index + 1}</span>
                <span>{line.expression}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
