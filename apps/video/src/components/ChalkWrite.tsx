import type {Txt} from "@motion-canvas/2d";
import type {ThreadGenerator} from "@motion-canvas/core";
import {waitFor} from "@motion-canvas/core";

export function* revealChalkText(
  textNode: Txt,
  fullText: string,
  durationSeconds: number,
): ThreadGenerator {
  const characterCount = Math.max(fullText.length, 1);
  const tick = durationSeconds / characterCount;
  textNode.opacity(1);
  textNode.text("");
  for (let index = 1; index <= fullText.length; index += 1) {
    textNode.text(fullText.slice(0, index));
    yield* waitFor(tick);
  }
}
