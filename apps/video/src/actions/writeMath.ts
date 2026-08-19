import type {Txt} from "@motion-canvas/2d";
import type {ThreadGenerator} from "@motion-canvas/core";

import {revealChalkText} from "../components/ChalkWrite";

export function* writeMath(line: Txt, fullText: string, duration: number): ThreadGenerator {
  yield* revealChalkText(line, fullText, duration);
}
