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

The root worksheet POV lab is the active lesson direction. It uses a seated study-room scene, in-world laptop auth/browser controls, worksheet focus, a Pomodoro clock, a visitor map, a phone focus gag, Lo-Fi ambience, and structured built-in lesson templates. The current lesson surface is no longer PDF-backed; PDFs may be authoring references, but the rendered page should come from reusable section layouts and semantic lesson data.

The near-term product split is teacher view versus student view. Student view should focus on completing the built-in lessons and using study helpers. Teacher view should preserve the current laptop pipeline/debug surface for inspecting artifacts, approvals, costs, and generation details.

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
7. Keep the root worksheet POV lab and `/v1` quadratic generator isolated from each other; reuse auth and static lesson primitives, but do not let room mechanics destabilize the quadratic generator.
8. Build the worksheet path around three predefined lessons before adding generated lesson authoring.

## Non-Goals

- Do not broaden beyond quadratics without an explicit product decision.
- Do not let an LLM solve math or invent deterministic transformations.
- Do not make optional avatar work required for the base educational video path.
- Do not rebuild credit or billing systems for the current internal workflow.
- Do not make Motion Canvas lesson-specific; it should stay a data-driven renderer.

## Quality Bar

A good change preserves rerunnability, makes failures diagnosable, and avoids provider calls when upstream inputs have not changed. A generated lesson is successful only when the math is correct, the narration is understandable, the animation is synchronized, and the final video is playable from the application.
