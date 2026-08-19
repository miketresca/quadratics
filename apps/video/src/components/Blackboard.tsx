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
      width={1740}
      height={940}
      radius={10}
      fill={board.surface}
      stroke={board.frame}
      lineWidth={14}
      shadowBlur={28}
      shadowColor="#00000099"
    >
      <Rect width={1688} height={888} radius={4} fill={board.surfaceDark} opacity={0.32} />
      <Rect width={1660} height={860} radius={4} stroke="#ffffff14" lineWidth={2} />
      <Layout layout direction="column" gap={30} width={1640} padding={82}>
        <Txt
          text={title}
          fill={board.chalk}
          fontSize={50}
          fontFamily="Chalkboard SE, Chalkduster, Bradley Hand, Comic Sans MS, cursive"
          shadowBlur={4}
          shadowColor="#f6f1dc55"
        />
        <Rect height={4} width={1460} fill={board.accent} opacity={0.58} />
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
                fontFamily="Chalkboard SE, Chalkduster, Bradley Hand, Comic Sans MS, cursive"
                opacity={0}
                shadowBlur={3}
                shadowColor="#f6f1dc44"
              />
            </Layout>
          ))}
        </Layout>
      </Layout>
    </Rect>
  );
}
