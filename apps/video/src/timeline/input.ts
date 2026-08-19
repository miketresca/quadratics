import type {Lesson, LessonNarration, MathLine, ResolvedAnimationCue, ResolvedAnimationTimeline} from "@quadratics/types";

export interface RenderInput {
  lesson: Lesson;
  timeline: ResolvedAnimationTimeline;
  narration?: LessonNarration;
  narrationStorageObjects?: Record<string, unknown>[];
}

export interface BlackboardLine extends MathLine {
  stepId: string;
  stepTitle: string;
  y: number;
}

export function flattenLessonLines(lesson: Lesson): BlackboardLine[] {
  const rawLines: Omit<BlackboardLine, "y">[] = [];
  for (const step of lesson.steps) {
    for (const line of step.mathLines) {
      rawLines.push({
        ...line,
        stepId: step.id,
        stepTitle: step.title
      });
    }
  }
  const availableHeight = 560;
  const gap = rawLines.length > 1
    ? Math.min(96, Math.max(58, availableHeight / (rawLines.length - 1)))
    : 0;
  const firstLineY = -280;
  return rawLines.map((line, index) => ({
    ...line,
    y: firstLineY + index * gap
  }));
}

export function lineById(lines: BlackboardLine[]): Map<string, BlackboardLine> {
  return new Map(lines.map((line) => [line.id, line]));
}

export function cuesInTimelineOrder(timeline: ResolvedAnimationTimeline): ResolvedAnimationCue[] {
  return [...timeline.cues].sort(
    (left, right) => left.animation.startSeconds - right.animation.startSeconds,
  );
}
