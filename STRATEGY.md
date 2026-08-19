# Strategy

## Product Thesis

Quadratics should behave like a transparent build system for educational videos. A user enters a math problem, watches the system create each artifact, and can rerun only the stage that needs improvement.

The core value is not just getting a final video. It is being able to inspect and control the production pipeline: deterministic math, teaching structure, narration, animation planning, timing resolution, rendering, and playback.

## Target User

The current product is an internal tool for building and evaluating generated math explanations. It is designed for a small trusted group that needs fast iteration, visible provider boundaries, and reusable artifacts more than consumer-grade account limits or billing flows.

## Current Product Shape

The supported end-to-end path is:

```text
quadratic input
  -> deterministic solution
  -> factoring lesson
  -> teacher script
  -> ElevenLabs-ready speech markup
  -> ElevenLabs narration and alignment
  -> semantic animation plan
  -> resolved animation timeline
  -> Motion Canvas blackboard render
  -> playable base video
```

The final video belongs in the Lesson view. Pipeline logs exist to show how the lesson was produced and to make each stage rerunnable.

## Strategic Principles

- Mathematical truth is deterministic. SymPy and domain code solve equations; LLMs explain and plan visuals only after the lesson exists.
- Artifacts are the product backbone. Every expensive stage must be persisted, versioned, inspectable, and independently rerunnable.
- Provider calls are isolated. OpenAI, ElevenLabs, avatar providers, storage, and render systems stay behind adapters.
- Narration alignment is reused. ElevenLabs character alignment is the timestamp source of truth for synchronization.
- Manual control beats hidden automation. The user should be able to run one stage at a time, see loading state locally, inspect errors, and keep useful upstream outputs.
- The golden checkpoint protects iteration speed. `x^2 + 5x + 6 = 0` is the canonical fixture for rendering and timing work without repeated provider calls.
- Video quality matters. The board should feel like a clear blackboard lesson: centered math, accumulating work, readable captions, and synchronized emphasis.

## Near-Term Priorities

1. Keep the current golden-case pipeline stable in local development and deployed environments.
2. Harden Motion Canvas rendering in production so Railway can reliably produce the same base video as local runs.
3. Improve the animation planner and resolver until the timeline reads like "speaker phrase -> exact timestamp -> visible board action".
4. Separate `elevenlabs_request` and `elevenlabs_audio` internally if request-only regeneration becomes useful; the UI already treats them as visible stages.
5. Expand blackboard primitives carefully: better final-answer boxing, term-level highlights, layout safeguards, and captions that do not cover math.
6. Add additional quadratic teaching methods only after factoring is dependable.

## Non-Goals

- Do not broaden beyond quadratics without an explicit product decision.
- Do not let an LLM solve math or invent deterministic transformations.
- Do not implement HeyGen/avatar composition until the base educational video path is stable.
- Do not rebuild credit or billing systems for the current internal workflow.
- Do not make Motion Canvas lesson-specific; it should stay a data-driven renderer.

## Quality Bar

A good change preserves rerunnability, makes failures diagnosable, and avoids provider calls when upstream inputs have not changed. A generated lesson is successful only when the math is correct, the narration is understandable, the animation is synchronized, and the final video is playable from the application.
