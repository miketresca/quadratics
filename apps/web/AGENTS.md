# Web Agent Guide

The web app owns the authenticated product shell, equation input, manual pipeline controls, artifact logs, playback surfaces, and final lesson preview.

## Important Paths

- `app` - Next.js App Router pages, layouts, server actions, and global styles
- `components` - equation form, lesson result, pipeline logs, controls, and shared UI
- `lib` - API client, Supabase client/server helpers, auth helpers, and view-state utilities
- `tests` - Vitest tests for frontend behavior

## Product UI Rules

Preserve the dark developer-tool aesthetic. The logs are part of the product story: they should show how the video was produced, not just whether a request succeeded.

The main workflow is manual and stage-by-stage. Submit an equation to get the deterministic answer and lesson. Then each runnable pipeline stage should expose a small, subtle action control. While a stage is running, the action area should show a spinner for that specific card rather than only disabling a button or freezing the whole UI.

The visible stage order should match the backend artifact pipeline:

```text
real_world_context (optional lesson enrichment)
teacher_script -> elevenlabs_request -> elevenlabs_audio -> heygen_avatar -> animation_plan -> resolved_timeline -> motion_canvas_render
```

`real_world_context` should be runnable from Logs and displayed in the Lesson tab IRL Example block; it should not be runnable from Lesson. `elevenlabs_request` should show the exact speech-markup text that will be sent to ElevenLabs, including break tags. `elevenlabs_audio` should show generated narration playback and segment metadata. `heygen_avatar` is optional, paid, and should clearly show estimates before running. Animation logs should make the relationship clear: narration phrase, timestamp, visual action, and resolved timing.

The final rendered video belongs in the Lesson view. Logs may mention render success and metadata, but they are not the primary video playback surface. The App/Demo toggle should preserve App state after switching tabs; avoid remounting the equation workflow just to show README/demo content.

Do not add marketing/landing-page patterns inside the authenticated app. This is an operator tool, not a public homepage.

## Auth And Security

Keep `/login` public as a redirect-only compatibility route and allow the root `/` shell to render as the main product surface. Gate equation submission, generation access, provider key management, and user-owned data behind Supabase auth. API calls must include the authenticated user context. Never expose service-role keys or provider secrets in client code.

Use shared contracts from `@quadratics/types` instead of duplicating backend shapes in ad hoc frontend-only types.

## Current System Knowledge

The standard path expects animation planning, Motion Canvas rendering, and a playable base video. Optional HeyGen avatar generation is a separate paid stage, not a separate app mode.

The UI may receive already completed artifacts when a signed-in user resubmits an equation they have generated before with the same instructor. Treat those as resumable checkpoints, not as a reason to regenerate from scratch.

Stale artifacts should remain inspectable with subtle stale styling. Failed artifacts should remain distinct from stale artifacts.

## Validation

For web changes, run:

```sh
pnpm --filter @quadratics/web lint
pnpm --filter @quadratics/web typecheck
pnpm --filter @quadratics/web test
```

Run browser/manual checks when changing interaction flow, auth, stage controls, video playback, or responsive layout.
