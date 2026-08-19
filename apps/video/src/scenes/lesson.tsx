import {Layout, Rect, Txt, makeScene2D} from "@motion-canvas/2d";
import {all, createRef, waitFor} from "@motion-canvas/core";

import {showVisualAction} from "../actions/highlight";
import {assertSupportedCue, durationForCue, isRenderableAction} from "../actions/dispatcher";
import {writeMath} from "../actions/writeMath";
import {chalkSfxTracksForTimeline} from "../audio/chalkEffects";
import {captionGroupsForNarration, captionWordSlots} from "../captions/captions";
import {renderCaptionTrack} from "../captions/renderCaptionTrack";
import {Blackboard} from "../components/Blackboard";
import {CaptionTrack} from "../components/CaptionTrack";
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
  const captionContainerRef = createRef<Rect>();
  const captionWordRefs = Array.from({length: captionWordSlots}, () => createRef<Txt>());
  const captionGroups = captionGroupsForNarration(input.narration);

  view.add(
    <Layout layout={false} width={1920} height={1080}>
      <Blackboard
        title="Factoring a quadratic"
        lines={lines}
        lineRefs={lineRefs}
        highlightRefs={highlightRefs}
      />
      <CaptionTrack containerRef={captionContainerRef} wordRefs={captionWordRefs} />
    </Layout>,
  );

  yield* all(
    (function* () {
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
          yield* writeMath(
            lineRefs[lineIndex](),
            linesById.get(lineId)!.expression,
            duration,
            isSolutionLine(lineId) ? board.solution : undefined,
          );
        } else if (
          lineId &&
          lineIndex !== undefined &&
          isRenderableAction(cue.animation.action) &&
          ["highlight", "emphasize", "circle", "underline", "box"].includes(cue.animation.action)
        ) {
          yield* showVisualAction(highlightRefs[lineIndex](), cue.animation.action, duration);
        } else {
          yield* waitFor(duration);
        }
        playhead = Math.max(playhead + wait + duration, cue.animation.endSeconds);
      }

      console.info(`Prepared ${chalkSfxTracks.length} chalk SFX cue(s).`);
      yield* waitFor(Math.max(0, input.timeline.durationSeconds - playhead));
    })(),
    renderCaptionTrack(
      captionContainerRef(),
      captionWordRefs.map((ref) => ref()),
      captionGroups,
      input.timeline.durationSeconds,
    ),
  );
});

function isSolutionLine(lineId: string): boolean {
  return lineId === "solutions" || lineId.endsWith("_solution");
}
