import {Layout, Rect, Txt, makeScene2D} from "@motion-canvas/2d";
import {all, createRef, waitFor} from "@motion-canvas/core";

import {sampleStep} from "../data/sample-step";
import {board} from "../styles/board";

export default makeScene2D(function* (view) {
  view.fill(board.background);

  const title = createRef<Txt>();
  const lineRefs = sampleStep.mathLines.map(() => createRef<Txt>());

  view.add(
    <Layout layout direction="column" gap={36} width={1600} padding={80}>
      <Txt ref={title} text={sampleStep.title} fill={board.chalk} fontSize={58} fontFamily="Arial" />
      <Rect height={4} width={1440} fill={board.accent} opacity={0.8} />
      <Layout layout direction="column" gap={24} paddingTop={30}>
        {sampleStep.mathLines.map((line, index) => (
          <Txt
            key={line.id}
            ref={lineRefs[index]}
            text={line.expression}
            fill={board.chalk}
            fontSize={48}
            fontFamily="JetBrains Mono, Menlo, monospace"
            opacity={0}
          />
        ))}
      </Layout>
    </Layout>
  );

  yield* waitFor(0.3);
  for (const ref of lineRefs) {
    yield* all(ref().opacity(1, 0.35), ref().x(24, 0.35));
    yield* waitFor(0.25);
  }
  yield* waitFor(1);
});
