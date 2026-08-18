# Domain Model

- Equation: user input that must contain one equality and variable `x`.
- Quadratic: normalized equation equivalent to `ax^2 + bx + c = 0`.
- Method: one of factoring, square-root, completing-the-square, or quadratic-formula.
- Lesson: structured explanation for one equation and method.
- Teaching step: meaningful instructional unit for narration, timing, and video segments.
- Math line: deterministic rendered transformation inside a teaching step.
- Script: LLM-assisted narration plan generated from a completed deterministic lesson.
- Script segment: narration text for one teaching step, with references to the math-line IDs it explains.
- Instructor: placeholder data record such as `male` or `female`.
- Generation job: owned audit record for a generation attempt.
- Credit transaction: ledger entry that grants or consumes generation credits.

Exact math values are preserved as strings and LaTeX. Display strings are not the only mathematical representation. Script text may explain the deterministic math, but it is not a source of mathematical truth.
