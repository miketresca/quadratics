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
      <BoardTexture />
      <Rect width={1818} height={978} radius={12} stroke={board.frame} lineWidth={9} opacity={0.58} />
      <Rect width={1768} height={928} radius={8} stroke={board.chalkGhost} lineWidth={2} opacity={0.24} />
      <Layout layout={false} width={1920} height={1080}>
        <Txt
          text={title}
          fill={board.chalk}
          fontSize={46}
          fontFamily="Chalkduster, Chalkboard SE, Bradley Hand, Comic Sans MS, cursive"
          x={-630}
          y={-455}
          rotation={-1.2}
          shadowBlur={7}
          shadowColor="#fbf7e86f"
          textAlign="left"
        />
        <Rect height={3} width={380} x={-625} y={-413} fill={board.accent} opacity={0.5} rotation={-1.2} />
        <Rect height={1} width={350} x={-619} y={-407} fill={board.chalkGhost} opacity={0.65} rotation={-1.2} />
        {lines.map((line, index) => {
          const mathFontSize = line.expression.length > 30 ? 44 : 52;
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
                fontFamily="Chalkduster, Chalkboard SE, Bradley Hand, Comic Sans MS, cursive"
                opacity={0}
                shadowBlur={6}
                shadowColor="#fbf7e866"
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
  const dust = Array.from({length: 190}, (_value, index) => {
    const x = seededRange(index, -890, 890);
    const y = seededRange(index + 199, -480, 480);
    const size = seededRange(index + 41, 0.8, 4.2);
    const opacity = seededRange(index + 83, 0.025, 0.11);
    return <Circle key={`dust-${index}`} x={x} y={y} size={size} fill={board.smudge} opacity={opacity} />;
  });
  const scratches = Array.from({length: 42}, (_value, index) => (
    <Rect
      key={`scratch-${index}`}
      x={seededRange(index + 311, -820, 820)}
      y={seededRange(index + 617, -420, 420)}
      width={seededRange(index + 23, 70, 260)}
      height={1}
      radius={1}
      fill={board.chalkGhost}
      opacity={seededRange(index + 971, 0.025, 0.09)}
      rotation={seededRange(index + 41, -2.5, 2.5)}
    />
  ));
  const smudges = [
    {x: -520, y: -210, width: 520, height: 48, opacity: 0.045},
    {x: 280, y: -70, width: 690, height: 42, opacity: 0.04},
    {x: -150, y: 155, width: 760, height: 54, opacity: 0.035},
    {x: 560, y: 305, width: 420, height: 36, opacity: 0.03},
  ];

  return (
    <Layout layout={false} width={1920} height={1080}>
      <Rect width={1920} height={1080} fill={board.surfaceDark} opacity={0.55} />
      <Rect width={1920} height={2} y={-360} fill={board.surfaceMid} opacity={0.22} />
      <Rect width={1920} height={2} y={-120} fill={board.surfaceMid} opacity={0.18} />
      <Rect width={1920} height={2} y={120} fill={board.surfaceMid} opacity={0.16} />
      <Rect width={1920} height={2} y={360} fill={board.surfaceMid} opacity={0.14} />
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
      {scratches}
      {dust}
      <Rect width={420} height={12} x={620} y={466} radius={6} fill={board.chalk} opacity={0.72} rotation={-0.5} />
      <Rect width={120} height={9} x={342} y={468} radius={5} fill={board.solution} opacity={0.58} rotation={1.1} />
    </Layout>
  );
}

function seededRange(seed: number, min: number, max: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return min + (value - Math.floor(value)) * (max - min);
}
