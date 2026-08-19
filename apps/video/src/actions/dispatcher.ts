import type {ResolvedAnimationCue} from "@quadratics/types";

export type RenderableAction = "write_math" | "write_text" | "highlight" | "emphasize" | "circle" | "underline" | "box" | "pause";

const supportedActions = new Set<RenderableAction>([
  "write_math",
  "write_text",
  "highlight",
  "emphasize",
  "circle",
  "underline",
  "box",
  "pause"
]);

export function assertSupportedCue(cue: ResolvedAnimationCue): void {
  if (!supportedActions.has(cue.animation.action as RenderableAction)) {
    throw new Error(`Unsupported animation action: ${cue.animation.action}`);
  }
}

export function durationForCue(cue: ResolvedAnimationCue): number {
  return Math.max(0, cue.animation.endSeconds - cue.animation.startSeconds);
}
