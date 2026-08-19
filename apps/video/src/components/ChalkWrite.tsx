import type {Rect, Txt} from "@motion-canvas/2d";
import type {ThreadGenerator} from "@motion-canvas/core";
import {waitFor} from "@motion-canvas/core";

export interface ChalkCursorOptions {
  cursor?: Rect;
  lineY?: number;
}

export function* revealChalkText(
  textNode: Txt,
  fullText: string,
  durationSeconds: number,
  options: ChalkCursorOptions = {},
): ThreadGenerator {
  const characterCount = Math.max(fullText.length, 1);
  const tick = durationSeconds / characterCount;
  const width = estimatedLineWidth(fullText);
  const startX = -width / 2;
  const cursor = options.cursor;

  textNode.opacity(1);
  textNode.text("");
  if (cursor && options.lineY !== undefined) {
    cursor.opacity(0.86);
    cursor.rotation(-13);
    cursor.position([startX - 18, options.lineY + 2]);
  }
  for (let index = 1; index <= fullText.length; index += 1) {
    textNode.text(fullText.slice(0, index));
    textNode.position([chalkJitter(index, 0.7), chalkJitter(index + 29, 0.55)]);
    textNode.shadowBlur(3.5 + Math.abs(chalkJitter(index + 11, 2)));
    if (cursor && options.lineY !== undefined) {
      const progress = index / characterCount;
      cursor.position([
        startX + width * progress + chalkJitter(index + 17, 7),
        options.lineY + chalkJitter(index + 47, 5),
      ]);
      cursor.opacity(index % 5 === 0 ? 0.66 : 0.88);
    }
    yield* waitFor(tick);
  }
  textNode.position([0, 0]);
  textNode.shadowBlur(5);
  if (cursor) {
    cursor.opacity(0);
  }
}

function estimatedLineWidth(text: string): number {
  return Math.min(1320, Math.max(180, text.length * 28));
}

function chalkJitter(seed: number, amplitude: number): number {
  const value = Math.sin(seed * 78.233) * 43758.5453;
  return (value - Math.floor(value) - 0.5) * amplitude;
}
