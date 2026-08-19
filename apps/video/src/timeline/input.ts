import type {Lesson, MathLine, ResolvedAnimationCue, ResolvedAnimationTimeline} from "@quadratics/types";

export interface RenderInput {
  lesson: Lesson;
  timeline: ResolvedAnimationTimeline;
}

export interface BlackboardLine extends MathLine {
  stepId: string;
  stepTitle: string;
  y: number;
}

export function flattenLessonLines(lesson: Lesson): BlackboardLine[] {
  const lines: BlackboardLine[] = [];
  let index = 0;
  for (const step of lesson.steps) {
    for (const line of step.mathLines) {
      lines.push({
        ...line,
        stepId: step.id,
        stepTitle: step.title,
        y: index * 96
      });
      index += 1;
    }
  }
  return lines;
}

export function lineById(lines: BlackboardLine[]): Map<string, BlackboardLine> {
  return new Map(lines.map((line) => [line.id, line]));
}

export function cuesInTimelineOrder(timeline: ResolvedAnimationTimeline): ResolvedAnimationCue[] {
  return [...timeline.cues].sort(
    (left, right) => left.animation.startSeconds - right.animation.startSeconds,
  );
}
