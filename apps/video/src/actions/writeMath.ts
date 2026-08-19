import type {Txt} from "@motion-canvas/2d";
import type {ThreadGenerator} from "@motion-canvas/core";
import {all} from "@motion-canvas/core";

export function* writeMath(line: Txt, duration: number): ThreadGenerator {
  yield* all(line.opacity(1, duration), line.x(24, duration));
}
