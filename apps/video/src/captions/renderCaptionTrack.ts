import type {Rect, Txt} from "@motion-canvas/2d";
import type {ThreadGenerator} from "@motion-canvas/core";
import {waitFor} from "@motion-canvas/core";

import type {CaptionGroup} from "./captions";
import {board} from "../styles/board";

export function* renderCaptionTrack(
  container: Rect,
  wordNodes: Txt[],
  groups: CaptionGroup[],
  durationSeconds: number,
): ThreadGenerator {
  let playhead = 0;
  container.opacity(0);

  for (const group of groups) {
    const wait = Math.max(0, group.startSeconds - playhead);
    if (wait > 0) {
      yield* waitFor(wait);
      playhead += wait;
    }

    setCaptionWords(wordNodes, group, -1);
    yield* container.opacity(1, 0.12);
    playhead += 0.12;

    for (let index = 0; index < group.words.length; index += 1) {
      const word = group.words[index];
      const wordWait = Math.max(0, word.startSeconds - playhead);
      if (wordWait > 0) {
        yield* waitFor(wordWait);
        playhead += wordWait;
      }
      setCaptionWords(wordNodes, group, index);
    }

    const groupWait = Math.max(0, group.endSeconds - playhead + 0.2);
    if (groupWait > 0) {
      yield* waitFor(groupWait);
      playhead += groupWait;
    }
    yield* container.opacity(0, 0.1);
    playhead += 0.1;
  }

  const finalWait = Math.max(0, durationSeconds - playhead);
  if (finalWait > 0) {
    yield* waitFor(finalWait);
  }
}

function setCaptionWords(wordNodes: Txt[], group: CaptionGroup, activeIndex: number): void {
  for (let index = 0; index < wordNodes.length; index += 1) {
    const node = wordNodes[index];
    const word = group.words[index];
    node.text(word?.text ?? "");
    node.fill(index === activeIndex ? board.captionActive : board.caption);
    node.scale(index === activeIndex ? 1.08 : 1);
  }
}
