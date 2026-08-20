import type {Rect} from "@motion-canvas/2d";
import type {ThreadGenerator} from "@motion-canvas/core";
import {waitFor} from "@motion-canvas/core";

import type {OverlayAction} from "./dispatcher";
import {board} from "../styles/board";

export function* showVisualAction(
  highlight: Rect,
  action: OverlayAction,
  duration: number,
): ThreadGenerator {
  configureShape(highlight, action);
  yield* highlight.opacity(opacityForAction(action), Math.min(duration, 0.18));
  if (action === "box") {
    yield* waitFor(Math.max(duration - 0.18, 0));
    return;
  }
  yield* highlight.opacity(0, Math.max(duration - 0.18, 0.12));
}

function configureShape(highlight: Rect, action: OverlayAction): void {
  highlight.fill(action === "highlight" || action === "emphasize" ? board.highlight : null);
  highlight.stroke(action === "box" || action === "circle" ? board.highlight : null);
  highlight.lineWidth(action === "box" || action === "circle" ? 5 : 0);
  highlight.radius(action === "circle" ? 999 : 10);
  highlight.height(action === "underline" ? 7 : 74);
  highlight.y(action === "underline" ? 39 : 0);
}

function opacityForAction(action: OverlayAction): number {
  if (action === "underline" || action === "box" || action === "circle") {
    return 0.86;
  }
  if (action === "emphasize") {
    return 0.22;
  }
  return 0.3;
}
