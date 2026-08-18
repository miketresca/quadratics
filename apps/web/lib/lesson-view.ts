import type {Lesson, LessonNarration, LessonScript, MathLine} from "@quadratics/types";

export type SolveViewState =
  | {kind: "idle"}
  | {
      kind: "submitting";
      lesson?: Lesson;
      script?: LessonScript;
      narration?: LessonNarration;
      scriptLoading?: boolean;
      narrationLoading?: boolean;
    }
  | {kind: "success"; lesson: Lesson; script?: LessonScript; narration?: LessonNarration}
  | {kind: "unsupported"; lesson: Lesson; script?: LessonScript; narration?: LessonNarration}
  | {kind: "error"; message: string};

export function stateForLesson(lesson: Lesson, script?: LessonScript, narration?: LessonNarration): SolveViewState {
  if (lesson.status === "unsupported_instructional_method") {
    return {kind: "unsupported", lesson, script, narration};
  }
  return {kind: "success", lesson, script, narration};
}

export function flattenLessonMathLines(lesson: Lesson): MathLine[] {
  if (lesson.status !== "completed") {
    return [];
  }
  return lesson.steps.flatMap((step) => step.mathLines);
}
