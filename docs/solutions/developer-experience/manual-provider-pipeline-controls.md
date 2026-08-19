---
title: Manual Provider Pipeline Controls
date: 2026-08-18
category: developer-experience
module: Web pipeline controls and narration generation
problem_type: developer_experience
component: frontend
severity: medium
applies_when:
  - "A user needs to inspect or retry one expensive provider step without regenerating the whole lesson."
  - "A generation pipeline has deterministic setup followed by paid or rate-limited provider calls."
tags: [manual-pipeline, narration, credits, provider-boundary]
---

# Manual Provider Pipeline Controls

## Context

The lesson pipeline mixes cheap deterministic work with expensive provider calls. Solving a quadratic and building deterministic lesson steps should not burn provider credits. Teacher-script generation, speech-markup formatting, and ElevenLabs narration can all cost money or hit provider limits.

During development, users need to inspect the result of each step and retry only the failing or poor-quality provider step.

## Guidance

Expose expensive provider calls as independently runnable pipeline steps. The default submit action should run the deterministic solve only. After that, the result view can offer manual controls for:

- running `teacher_script`
- running `elevenlabs_request` and `elevenlabs_audio`
- retrying one narration segment
- running the full pipeline with a deliberate `Run A to Z` action

Keep the logs aligned with the real provider boundary. `teacher_script` is the high-level narration plan. `elevenlabs_request` is the speech-markup text sent to the narration provider, including SSML break tags. `elevenlabs_audio` is the provider response and audio playback.

For retries, preserve successful prior work when the replacement attempt fails. A failed single-segment retry should attach the new error message to the existing completed narration instead of discarding every previously generated audio segment.

## Why This Matters

Manual pipeline controls reduce accidental spend. They also make provider failures easier to debug because each boundary has a visible input and output.

The segment boundary is also the future Motion Canvas boundary. When each narration segment is tied to one script segment and teaching step, the animation timeline can map audio, board state, and math-line visibility without splitting a single long audio file later.

## When to Apply

- Use this pattern when adding a new paid provider step.
- Use it when a step output needs human inspection before the next step runs.
- Use it when a pipeline step can be retried without invalidating prior deterministic work.
- Avoid automatic retries until idempotency and billing behavior are explicit.

## Examples

Manual flow:

```text
solve
  -> run teacher_script
  -> run elevenlabs_request + elevenlabs_audio
  -> retry one narration segment if needed
```

Full flow:

```text
solve
  -> Run A to Z
  -> teacher_script
  -> elevenlabs_request
  -> elevenlabs_audio
```

Retry merge behavior:

```text
previous completed segments + failed replacement segment
  -> keep previous completed segments
  -> show the replacement error as a retry diagnostic
```

## Related

- [Video Pipeline](../../video-pipeline.md)
- [Auth and Usage](../../auth-and-usage.md)
- [Credit Ledger Decision](../../decisions/005-credit-ledger.md)
