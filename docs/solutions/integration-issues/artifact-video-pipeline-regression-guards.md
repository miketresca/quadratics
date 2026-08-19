---
title: Artifact Video Pipeline Regression Guards
date: 2026-08-19
category: integration-issues
module: Artifact video generation pipeline
problem_type: integration_issue
component: generation-pipeline
severity: high
applies_when:
  - "A generated video pipeline has provider, timing, render, and storage stages that can regress independently."
  - "A user needs to rerun one stage without losing or regenerating expensive upstream artifacts."
tags: [artifact-pipeline, elevenlabs, motion-canvas, reruns, golden-checkpoint]
---

# Artifact Video Pipeline Regression Guards

## Context

The video pipeline crosses deterministic math, OpenAI, ElevenLabs, Supabase Storage, timestamp resolution, Motion Canvas, and FFmpeg. A regression in one stage can make later artifacts look incorrect even when upstream math or narration is still valid.

The important operating model is:

```text
persist upstream artifact
  -> generate one downstream artifact
  -> validate it
  -> make it inspectable
  -> rerun only that stage when needed
```

## Guidance

Keep `teacher_script`, `elevenlabs_request`, and `elevenlabs_audio` visually and architecturally distinct. The script is the high-level lesson narration. The request is the conversation-ready provider text with SSML breaks. The audio artifact is the provider response, media references, and alignment data.

Use deterministic guards at every boundary:

- cap speech markup so the golden lesson stays short enough for review
- validate animation cues against existing teaching steps and math-line IDs
- allow non-write visual cues to reference prior visible math lines, but keep `write_math` tied to the line's owning step
- resolve animation timing from ElevenLabs alignment rather than asking another model to infer timestamps
- persist render failures as failed artifacts instead of leaving the UI stuck on a running stage
- show per-stage spinners and rerun controls so failures are local to the card that is running

For production renders, verify the deployed API can run the Motion Canvas command from a checkout that includes `apps/video`. If the process working directory is not the monorepo root, configure `MOTION_CANVAS_RENDER_CWD`.

For repeated testing, use the golden checkpoint for `x^2 + 5x + 6 = 0`. In development it should reopen prior artifacts for the same user and instructor. Outside development, enable that behavior with `GOLDEN_CHECKPOINT_REUSE_ENABLED=true`.

## Why This Matters

Without stage-level guards, a bad speech-markup response can create long audio, which then produces poor phrase matching, which makes the animation plan and final render look broken. Without persisted failures, the UI can appear stuck even though the renderer failed. Without golden checkpoint reuse, every refresh risks burning provider credits and obscuring whether the regression came from new code or new provider output.

## When to Apply

- Apply this pattern when adding a provider-backed stage.
- Apply it when a stage output becomes an input to timing or rendering.
- Apply it when production behavior differs from local rendering.
- Apply it before changing prompts, resolver matching, or Motion Canvas layout.

## Related

- [Video Pipeline](../../video-pipeline.md)
- [Architecture](../../architecture.md)
- [Manual Artifact Pipeline Controls](../developer-experience/manual-provider-pipeline-controls.md)
