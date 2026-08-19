import {Layout, Rect, Txt} from "@motion-canvas/2d";
import type {Reference} from "@motion-canvas/core";

import type {BlackboardLine} from "../timeline/input";
import {board} from "../styles/board";

interface BlackboardProps {
  title: string;
  lines: BlackboardLine[];
  lineRefs: Reference<Txt>[];
  highlightRefs: Reference<Rect>[];
}

export function Blackboard({title, lines, lineRefs, highlightRefs}: BlackboardProps) {
  return (
    <Rect
      width={1920}
      height={1080}
      radius={0}
      fill={board.surface}
    >
      <Rect width={1920} height={1080} fill={board.surfaceDark} opacity={0.28} />
      <Layout layout={false} width={1920} height={1080}>
        <Txt
          text={title}
          fill={board.chalk}
          fontSize={42}
          fontFamily="Chalkboard SE, Chalkduster, Bradley Hand, Comic Sans MS, cursive"
          x={-630}
          y={-455}
          shadowBlur={4}
          shadowColor="#f6f1dc55"
          textAlign="left"
        />
        <Rect height={3} width={360} x={-630} y={-416} fill={board.accent} opacity={0.48} />
        {lines.map((line, index) => {
          const mathFontSize = line.expression.length > 30 ? 42 : 50;
          return (
            <Layout key={line.id} position={[0, line.y]}>
              <Rect
                ref={highlightRefs[index]}
                width={Math.min(1320, Math.max(220, line.expression.length * mathFontSize * 0.68 + 64))}
                height={74}
                radius={10}
                fill={board.highlight}
                opacity={0}
              />
              <Txt
                ref={lineRefs[index]}
                text=""
                fill={board.chalk}
                fontSize={mathFontSize}
                fontFamily="Chalkboard SE, Chalkduster, Bradley Hand, Comic Sans MS, cursive"
                opacity={0}
                shadowBlur={3}
                shadowColor="#f6f1dc44"
                textAlign="center"
                width={1500}
              />
            </Layout>
          );
        })}
      </Layout>
    </Rect>
  );
}
