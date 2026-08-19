---
title: Manual Artifact Pipeline Controls
date: 2026-08-18
category: developer-experience
module: Web pipeline controls and narration generation
problem_type: developer_experience
component: frontend
severity: medium
applies_when:
  - "A user needs to inspect or retry one expensive provider step without regenerating the whole lesson."
  - "A generation pipeline has deterministic setup followed by paid or rate-limited provider calls."
tags: [manual-pipeline, narration, provider-boundary]
---

# Manual Artifact Pipeline Controls

## Context

The lesson pipeline mixes cheap deterministic work with provider calls and render work. Solving a quadratic and building deterministic lesson steps should not rerun OpenAI, ElevenLabs, or Motion Canvas. Teacher-script generation, speech-markup formatting, ElevenLabs narration, animation planning, and rendering all need separate artifact boundaries.

During development, users need to inspect the result of each step and retry only the failing or poor-quality downstream step. ElevenLabs request and audio regeneration are exposed as deliberate per-stage controls, because narration can be expensive and should be rerun only when the user explicitly asks for it.

## Guidance

Expose expensive provider calls as independently runnable pipeline steps. The default submit action should run the deterministic solve only. After that, the result view can offer manual controls for:

- running `teacher_script`
- running or deliberately regenerating `elevenlabs_request` and `elevenlabs_audio`
- running `animation_plan`
- running `resolved_timeline`
- running `motion_canvas_render`
- continuing one visible stage at a time through the pipeline

Keep the logs aligned with the real provider boundary. `teacher_script` is the high-level narration plan. `elevenlabs_request` is the speech-markup text sent to the narration provider, including SSML break tags. `elevenlabs_audio` is the provider response, alignment, and media reference. `animation_plan` is semantic planner output. `resolved_timeline` is deterministic timing. `motion_canvas_render` is the render attempt.

For retries, preserve successful prior work when the replacement attempt fails. A failed stage attempt should attach the new error message to that stage without discarding useful upstream artifacts. Narration regeneration should remain deliberate because it can spend provider credits, but it must be available when the request text or audio quality needs correction.

When a stage is regenerated, mark affected downstream artifacts stale rather than deleting them. Stale plans, timelines, and renders are debugging material, but they should not be presented as the current final video.

## Why This Matters

Manual pipeline controls reduce accidental provider calls. They also make provider failures easier to debug because each boundary has a visible input and output.

The segment boundary is also the Motion Canvas boundary. When each narration segment is tied to one script segment and teaching step, the animation timeline can map audio, board state, and math-line visibility without splitting a single long audio file later.

## When to Apply

- Use this pattern when adding a new paid provider step.
- Use it when a step output needs human inspection before the next step runs.
- Use it when a pipeline step can be retried without invalidating prior deterministic work.
- Use it when downstream animation or render work can iterate against a fixed narration artifact.
- Avoid automatic retries until idempotency and billing behavior are explicit.

## Examples

Manual flow:

```text
solve
  -> run teacher_script
  -> run elevenlabs_request + elevenlabs_audio
  -> run animation_plan
  -> run resolved_timeline
  -> run motion_canvas_render
```

Step-by-step flow:

```text
solve
  -> run teacher_script
  -> run elevenlabs_request + elevenlabs_audio
  -> run animation_plan
  -> run resolved_timeline
  -> run motion_canvas_render
  -> inspect base_video in Lesson view
```

Stale behavior:

```text
regenerate animation_plan
  -> keep previous timeline/render inspectable
  -> mark affected downstream artifacts stale
  -> require explicit rerun before showing a new current video
```

## Related

- [Video Pipeline](../../video-pipeline.md)
- [Auth and Usage](../../auth-and-usage.md)
