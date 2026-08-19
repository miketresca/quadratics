import type {Rect} from "@motion-canvas/2d";
import type {ThreadGenerator} from "@motion-canvas/core";

export function* showHighlight(highlight: Rect, duration: number): ThreadGenerator {
  yield* highlight.opacity(0.34, Math.min(duration, 0.2));
  yield* highlight.opacity(0, Math.max(duration - 0.2, 0.1));
}
