import {Layout, Rect, Txt} from "@motion-canvas/2d";
import type {Reference} from "@motion-canvas/core";

import {captionWordSlots} from "../captions/captions";
import {board} from "../styles/board";

interface CaptionTrackProps {
  containerRef: Reference<Rect>;
  wordRefs: Reference<Txt>[];
}

export function CaptionTrack({containerRef, wordRefs}: CaptionTrackProps) {
  return (
    <Rect
      ref={containerRef}
      x={0}
      y={438}
      width={1540}
      height={112}
      radius={14}
      fill={board.captionBackground}
      opacity={0}
      shadowBlur={18}
      shadowColor="#00000099"
    >
      <Layout
        layout
        direction="row"
        gap={14}
        justifyContent="center"
        alignItems="center"
        width={1480}
        height={92}
      >
        {Array.from({length: captionWordSlots}).map((_, index) => (
          <Txt
            key={`caption-word-${index}`}
            ref={wordRefs[index]}
            text=""
            fill={board.caption}
            fontSize={40}
            fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
            fontWeight={800}
            shadowBlur={5}
            shadowColor="#000000"
          />
        ))}
      </Layout>
    </Rect>
  );
}
