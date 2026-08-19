import {Circle, Layout, Rect, Txt} from "@motion-canvas/2d";
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
      <Rect width={1920} height={1080} fill={board.surfaceDark} opacity={0.3} />
      <Rect width={1810} height={970} radius={18} stroke={board.frame} lineWidth={7} opacity={0.28} />
      <Rect width={1760} height={920} radius={12} stroke={board.chalkGhost} lineWidth={2} opacity={0.28} />
      <BoardTexture />
      <Layout layout={false} width={1920} height={1080}>
        <Txt
          text={title}
          fill={board.chalk}
          fontSize={42}
          fontFamily="Chalkboard SE, Chalkduster, Bradley Hand, Comic Sans MS, cursive"
          x={-630}
          y={-455}
          shadowBlur={5}
          shadowColor="#f6f1dc66"
          textAlign="left"
        />
        <Rect height={3} width={360} x={-630} y={-416} fill={board.accent} opacity={0.52} />
        <Rect height={1} width={340} x={-626} y={-411} fill={board.chalkGhost} opacity={0.7} />
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
                shadowBlur={5}
                shadowColor="#f6f1dc55"
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

function BoardTexture() {
  const dust = Array.from({length: 130}, (_value, index) => {
    const x = seededRange(index, -890, 890);
    const y = seededRange(index + 199, -480, 480);
    const size = seededRange(index + 41, 1.2, 4.8);
    const opacity = seededRange(index + 83, 0.035, 0.13);
    return <Circle key={`dust-${index}`} x={x} y={y} size={size} fill={board.smudge} opacity={opacity} />;
  });
  const smudges = [
    {x: -520, y: -210, width: 520, height: 48, opacity: 0.055},
    {x: 280, y: -70, width: 690, height: 42, opacity: 0.045},
    {x: -150, y: 155, width: 760, height: 54, opacity: 0.04},
    {x: 560, y: 305, width: 420, height: 36, opacity: 0.035},
  ];

  return (
    <Layout layout={false} width={1920} height={1080}>
      <Rect width={1920} height={2} y={-360} fill={board.surfaceMid} opacity={0.35} />
      <Rect width={1920} height={2} y={-120} fill={board.surfaceMid} opacity={0.28} />
      <Rect width={1920} height={2} y={120} fill={board.surfaceMid} opacity={0.24} />
      <Rect width={1920} height={2} y={360} fill={board.surfaceMid} opacity={0.2} />
      {smudges.map((smudge, index) => (
        <Rect
          key={`smudge-${index}`}
          x={smudge.x}
          y={smudge.y}
          width={smudge.width}
          height={smudge.height}
          radius={28}
          fill={board.smudge}
          opacity={smudge.opacity}
        />
      ))}
      {dust}
    </Layout>
  );
}

function seededRange(seed: number, min: number, max: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return min + (value - Math.floor(value)) * (max - min);
}
