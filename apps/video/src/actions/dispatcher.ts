import type {AnimationPrimitive, ResolvedAnimationCue} from "@quadratics/types";

export type RenderableAction = AnimationPrimitive;
export type OverlayAction = "highlight" | "emphasize" | "circle" | "underline" | "box";

const supportedActions = new Set<RenderableAction>([
  "write_math",
  "write_text",
  "highlight",
  "emphasize",
  "circle",
  "underline",
  "box",
  "arrow",
  "erase_annotation",
  "replace_fragment",
  "point",
  "dim",
  "restore",
  "pause"
]);

export function assertSupportedCue(cue: ResolvedAnimationCue): void {
  if (!supportedActions.has(cue.animation.action as RenderableAction)) {
    throw new Error(`Unsupported animation action: ${cue.animation.action}`);
  }
}

export function isRenderableAction(action: string): action is RenderableAction {
  return supportedActions.has(action as RenderableAction);
}

export function overlayActionFor(action: RenderableAction): OverlayAction | null {
  if (action === "highlight" || action === "emphasize" || action === "circle" || action === "underline" || action === "box") {
    return action;
  }
  if (action === "point" || action === "arrow") {
    return "emphasize";
  }
  if (action === "dim") {
    return "highlight";
  }
  return null;
}

export function durationForCue(cue: ResolvedAnimationCue): number {
  return Math.max(0, cue.animation.endSeconds - cue.animation.startSeconds);
}
