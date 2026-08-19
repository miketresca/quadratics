import type {Rect, Txt} from "@motion-canvas/2d";
import type {ThreadGenerator} from "@motion-canvas/core";

import {revealChalkText} from "../components/ChalkWrite";

export function* writeMath(
  line: Txt,
  fullText: string,
  duration: number,
  fill?: string,
  cursor?: Rect,
  lineY?: number,
): ThreadGenerator {
  if (fill) {
    line.fill(fill);
    line.shadowColor(`${fill}66`);
  }
  yield* revealChalkText(line, fullText, duration, {cursor, lineY});
}
