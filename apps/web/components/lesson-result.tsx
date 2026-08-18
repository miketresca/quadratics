import type {Lesson} from "@quadratics/types";

export function LessonResult({lesson}: {lesson: Lesson}) {
  return (
    <section className="mt-8" aria-live="polite">
      <div className="rounded border border-neutral-300 bg-white p-4">
        <h2 className="text-xl font-semibold">Answer</h2>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium">Normalized equation</dt>
            <dd>{lesson.normalizedEquation}</dd>
          </div>
          <div>
            <dt className="font-medium">Method</dt>
            <dd>{lesson.method ?? "Unsupported for v0 lessons"}</dd>
          </div>
          <div>
            <dt className="font-medium">Coefficients</dt>
            <dd>
              a={lesson.coefficients.a.expression}, b={lesson.coefficients.b.expression}, c=
              {lesson.coefficients.c.expression}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Roots</dt>
            <dd>{lesson.solutions.map((solution) => solution.expression).join(", ")}</dd>
          </div>
        </dl>
        {lesson.unsupportedReason ? (
          <p className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {lesson.unsupportedReason}
          </p>
        ) : null}
      </div>

      {lesson.steps.length > 0 ? (
        <ol className="mt-6 grid gap-4">
          {lesson.steps.map((step) => (
            <li key={step.id} className="rounded border border-neutral-300 bg-white p-4">
              <h3 className="font-semibold">{step.title}</h3>
              <ul className="mt-3 grid gap-2 font-mono text-sm">
                {step.mathLines.map((line) => (
                  <li key={line.id}>{line.expression}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
