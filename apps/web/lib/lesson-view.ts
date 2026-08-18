import type {Lesson, LessonScript, MathLine} from "@quadratics/types";

export type SolveViewState =
  | {kind: "idle"}
  | {kind: "submitting"}
  | {kind: "success"; lesson: Lesson; script?: LessonScript}
  | {kind: "unsupported"; lesson: Lesson; script?: LessonScript}
  | {kind: "error"; message: string};

export function stateForLesson(lesson: Lesson, script?: LessonScript): SolveViewState {
  if (lesson.status === "unsupported_instructional_method") {
    return {kind: "unsupported", lesson, script};
  }
  return {kind: "success", lesson, script};
}

export function flattenLessonMathLines(lesson: Lesson): MathLine[] {
  if (lesson.status !== "completed") {
    return [];
  }
  return lesson.steps.flatMap((step) => step.mathLines);
}
