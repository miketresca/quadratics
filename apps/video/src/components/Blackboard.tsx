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
    <Layout layout direction="column" gap={30} width={1640} padding={82}>
      <Txt text={title} fill={board.chalk} fontSize={50} fontFamily="Arial" />
      <Rect height={4} width={1460} fill={board.accent} opacity={0.7} />
      <Layout layout={false} width={1500} height={760}>
        {lines.map((line, index) => (
          <Layout key={line.id} position={[-700, -330 + line.y]}>
            <Rect
              ref={highlightRefs[index]}
              width={line.expression.length * 32 + 42}
              height={66}
              x={20}
              y={8}
              radius={8}
              fill={board.highlight}
              opacity={0}
            />
            <Txt
              ref={lineRefs[index]}
              text=""
              fill={board.chalk}
              fontSize={46}
              fontFamily="JetBrains Mono, Menlo, monospace"
              opacity={0}
            />
          </Layout>
        ))}
      </Layout>
    </Layout>
  );
}
