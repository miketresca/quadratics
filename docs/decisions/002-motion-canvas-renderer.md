# 002. Motion Canvas Renderer

## Decision

Use Motion Canvas for deterministic educational math animation rather than generative video for the board/background.

## Context

The board animation needs exact math timing and repeatable rendering. The renderer should consume lesson display data and a resolved animation timeline, not arbitrary LLM-authored scene code.

## Consequences

Motion Canvas consumes structured lesson data, a constrained animation primitive set, narration media references, and deterministic timeline windows. Generative video providers are deferred and must not own board math.

The semantic animation planner may decide that a line should be written or highlighted, but the renderer remains responsible for deterministic execution. Chalk writing and chalk SFX are reusable primitives tied to resolved timeline windows.
