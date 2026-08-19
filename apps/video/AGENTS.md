# Video Agent Guide

The video app owns deterministic Motion Canvas rendering. It should consume lesson display data, narration metadata, and a resolved timeline. It should not solve math, call LLMs, or decide semantic pedagogy.

## Important Paths

- `src/scenes` - Motion Canvas scene entry points and generated scene metadata
- `src/components` - blackboard, chalk text/math, captions, highlights, and annotations
- `src/actions` - reusable cue actions such as writing, highlighting, boxing, and underlining
- `src/timeline` - cue dispatch and absolute timing helpers
- `src/audio` - narration and chalk-SFX integration
- `scripts/render-from-input.mjs` - command adapter used by the API render stage
- `public/audio` - local audio assets such as optional chalk SFX

## Renderer Rules

Keep the renderer data-driven. It should render the supplied lesson and `ResolvedAnimationTimeline`; it should not contain hardcoded quadratic-specific logic beyond generic math display behavior.

The board style should be simple and readable: fullscreen blackboard/black background, centered math work, title in the upper-left when present, bottom captions, and no empty frame around the board.

Math work should accumulate vertically like a teacher using a board. Prior lines should remain visible when space permits. Temporary emphasis should not erase mathematical history.

Captions should improve dead time without covering important math. When layout gets tight, protect the math area before adding decorative motion.

Highlight, underline, and box actions must target the visual line/fragment they claim to target. If a target cannot be resolved, prefer a clear validation/render error over silently drawing attention in the wrong place.

Use absolute resolved timestamps as the master clock. Avoid accumulating arbitrary waits that can drift audio and visuals out of sync.

## Render Command

The API invokes rendering through:

```env
MOTION_CANVAS_RENDER_COMMAND=pnpm --filter @quadratics/video render
```

The command expects:

```env
QUADRATICS_RENDER_INPUT_PATH=
QUADRATICS_RENDER_OUTPUT_PATH=
```

It may download signed narration segment URLs, concatenate audio, render frames headlessly, and mux the final MP4 with `ffmpeg`. Production render environments need Chrome/Chromium and `ffmpeg`.

`apps/video/src/scenes/lesson.meta` is Motion Canvas-generated metadata and may change during local renders. Do not commit metadata churn unless it is intentionally part of the change.

## Validation

For video changes, run:

```sh
pnpm --filter @quadratics/video lint
pnpm --filter @quadratics/video typecheck
pnpm --filter @quadratics/video build
pnpm video:fixture
```

For visual changes, render the golden fixture and inspect the MP4 for synchronization, layout, captions, and target accuracy.
