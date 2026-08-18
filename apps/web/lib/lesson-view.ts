import type {Lesson, MathLine} from "@quadratics/types";

export type SolveViewState =
  | {kind: "idle"}
  | {kind: "submitting"}
  | {kind: "success"; lesson: Lesson}
  | {kind: "unsupported"; lesson: Lesson}
  | {kind: "error"; message: string};

export function stateForLesson(lesson: Lesson): SolveViewState {
  if (lesson.status === "unsupported_instructional_method") {
    return {kind: "unsupported", lesson};
  }
  return {kind: "success", lesson};
}

export function flattenLessonMathLines(lesson: Lesson): MathLine[] {
  if (lesson.status !== "completed") {
    return [];
  }
  return lesson.steps.flatMap((step) => step.mathLines);
}
