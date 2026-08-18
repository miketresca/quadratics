# 002. Motion Canvas Renderer

## Decision

Use Motion Canvas for deterministic educational math animation rather than generative video for the board/background.

## Context

The board animation needs exact math timing and repeatable rendering.

## Consequences

Motion Canvas consumes structured lesson data. Generative video providers are deferred and must not own board math.
