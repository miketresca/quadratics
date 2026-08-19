# API Agent Guide

The API owns deterministic math, lesson construction, provider orchestration, artifact persistence, Supabase access, and render-stage execution.

## Important Paths

- `app/api/routes` - FastAPI route handlers
- `app/services/math` - parsing, validation, SymPy solving, and method detection
- `app/services/lessons` - deterministic teaching-step and math-line construction
- `app/services/scripts` - teacher script and speech-markup orchestration
- `app/services/narration` - ElevenLabs narration, segment metadata, alignment, and media references
- `app/services/animation` - semantic animation planning, validation, and timestamp resolution
- `app/services/rendering` - render adapter boundary and Motion Canvas command integration
- `app/providers` - provider adapters for OpenAI, ElevenLabs, and future services
- `app/repositories` - persistence adapters and Supabase-backed storage
- `tests` - API unit and integration tests

## Rules

SymPy and deterministic code are the mathematical source of truth. Provider output may explain existing math, but it must not introduce roots, transformations, teaching-step IDs, or math-line IDs.

Keep provider SDKs behind adapters. Core math and lesson modules should not import OpenAI, ElevenLabs, Supabase Storage, or render-command details.

Every generation stage should produce a versioned artifact with lifecycle state, input hash, upstream artifact IDs, provider/model/config metadata, cache-hit state, timing metadata where relevant, and error/stale details when needed.

Replacing an upstream artifact should stale affected downstream artifacts, not delete them. Failed downstream stages must not destroy completed upstream artifacts.

Do not expose service-role credentials or provider secrets to the frontend. Do not log bearer tokens, service-role keys, provider API keys, or full raw provider requests by default.

The credit ledger is legacy infrastructure. Do not expand it for new product behavior unless explicitly requested.

## Current System Knowledge

`teacher_script` is high-level narration. `elevenlabs_request` is the conversation-ready speech text and SSML break-tag artifact. `elevenlabs_audio` is generated audio plus ElevenLabs alignment and storage references.

The speech-markup provider should keep narration concise enough for short videos. The current golden-case target should stay comfortably under 60 seconds.

The animation planner creates semantic cues only. The resolver maps narration trigger phrases to ElevenLabs alignment and creates exact animation, caption, and SFX windows.

`write_math` cues should target math lines owned by their teaching step. Non-write visual cues may reference prior visible math lines when pedagogically useful.

The render stage is command-backed when `MOTION_CANVAS_RENDER_COMMAND` is configured. Use `MOTION_CANVAS_RENDER_CWD` when the API process does not run from the monorepo root.

The golden equation `x^2 + 5x + 6 = 0` can reopen existing checkpoints for the same user/instructor in development, and outside development when `GOLDEN_CHECKPOINT_REUSE_ENABLED=true`.

## Validation

For API changes, run:

```sh
uv run --project apps/api pytest
pnpm lint
pnpm typecheck
```

Add focused tests for math correctness, provider fallback behavior, artifact stale propagation, cache behavior, animation-plan validation, and timestamp resolution.
