import {Rect, Txt, makeScene2D} from "@motion-canvas/2d";
import {createRef, waitFor} from "@motion-canvas/core";

import {showHighlight} from "../actions/highlight";
import {assertSupportedCue, durationForCue} from "../actions/dispatcher";
import {writeMath} from "../actions/writeMath";
import {chalkSfxTracksForTimeline} from "../audio/chalkEffects";
import {Blackboard} from "../components/Blackboard";
import {goldenRenderInput} from "../data/golden";
import generatedRenderInput from "../data/render-input.generated.json";
import {board} from "../styles/board";
import {cuesInTimelineOrder, flattenLessonLines, lineById} from "../timeline/input";

export default makeScene2D(function* (view) {
  view.fill(board.background);

  const input = generatedRenderInput ?? goldenRenderInput;
  const lines = flattenLessonLines(input.lesson);
  const linesById = lineById(lines);
  const lineRefs = lines.map(() => createRef<Txt>());
  const highlightRefs = lines.map(() => createRef<Rect>());
  const lineIndexById = new Map(lines.map((line, index) => [line.id, index]));
  const chalkSfxTracks = chalkSfxTracksForTimeline(input.timeline);

  view.add(
    <Blackboard
      title="Factoring a quadratic"
      lines={lines}
      lineRefs={lineRefs}
      highlightRefs={highlightRefs}
    />,
  );

  let playhead = 0;
  for (const cue of cuesInTimelineOrder(input.timeline)) {
    assertSupportedCue(cue);
    const wait = Math.max(0, cue.animation.startSeconds - playhead);
    if (wait > 0) {
      yield* waitFor(wait);
    }
    const duration = durationForCue(cue);
    const lineId = cue.mathLineId;
    const lineIndex = lineId ? lineIndexById.get(lineId) : undefined;

    if (
      lineId &&
      lineIndex !== undefined &&
      linesById.has(lineId) &&
      cue.animation.action === "write_math"
    ) {
      yield* writeMath(lineRefs[lineIndex](), linesById.get(lineId)!.expression, duration);
    } else if (
      lineId &&
      lineIndex !== undefined &&
      ["highlight", "emphasize", "circle", "underline", "box"].includes(cue.animation.action)
    ) {
      yield* showHighlight(highlightRefs[lineIndex](), duration);
    } else {
      yield* waitFor(duration);
    }
    playhead = Math.max(playhead + wait + duration, cue.animation.endSeconds);
  }

  console.info(`Prepared ${chalkSfxTracks.length} chalk SFX cue(s).`);
  yield* waitFor(Math.max(0, input.timeline.durationSeconds - playhead));
});
