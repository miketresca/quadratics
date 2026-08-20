# Quadratics

Quadratics is an internal build-system style generator for short math lesson videos. It takes a quadratic equation, solves it deterministically, turns the solution into a teaching script, generates narrated audio with alignment data, plans synchronized blackboard animation, and renders a playable Motion Canvas video.

The project exists to make educational video generation inspectable and repeatable. Every expensive or failure-prone boundary is represented as a persisted artifact so a user can rerun one stage, inspect its input/output, and continue without rebuilding the whole lesson or spending provider credits unnecessarily.

## Capabilities

- Deterministic quadratic parsing and solving with SymPy
- Factoring-based lesson construction with explicit teaching steps and math-line IDs
- OpenAI-backed teacher script generation from deterministic lesson data
- Conversation-ready ElevenLabs request generation with SSML break tags
- ElevenLabs narration with per-segment audio, character alignment, and signed playback URLs
- Optional HeyGen avatar clip generation from completed ElevenLabs narration segments
- Optional real-world lesson context for the Lesson tab, generated from deterministic lesson data
- Artifact-backed pipeline stages with versions, input hashes, stale propagation, cache reuse, and manual reruns
- Semantic animation planning with constrained visual primitives
- Deterministic narration-phrase to timestamp resolution from ElevenLabs alignment
- Data-driven Motion Canvas blackboard rendering with captions, chalk-style writing, highlights, boxes, and muxed narration
- Supabase Auth, Postgres-backed generation records, and private Supabase Storage media
- Global Supabase-backed instructors with voice IDs, avatar IDs, and reference images
- Provider usage cost logging for signed-in users
- Account-scoped generation reuse so repeated equations reopen saved artifacts instead of spending provider credits again
- `/game` prototype route with a game-style character select, WebGL lesson arena, local static prototype assets, account-scoped progress, a redacted logs drawer, and one PDF-backed placeholder lesson

## Repository Structure

- `apps/web` - Next.js App Router application, shared auth shell, equation input, lesson preview, pipeline logs, and `/game` prototype UI
- `apps/api` - FastAPI service, deterministic math, lesson/script/narration/animation orchestration, game progress persistence, provider adapters, Supabase repositories, and render boundary
- `apps/video` - Motion Canvas renderer and command-line render adapter
- `packages/types` - Shared TypeScript contracts for lessons, scripts, artifacts, animation plans, and timelines
- `packages/config` - Shared app configuration such as instructor placeholders
- `infra/supabase` - Supabase migrations and setup notes
- `fixtures/golden` - Development fixture data for the canonical quadratic
- `docs` - Architecture, domain model, video pipeline, ADRs, plans, and solved-problem notes

## Architecture

The current pipeline is:

```text
solution
  -> lesson
  -> real_world_context (optional lesson enrichment)
  -> teacher_script
  -> elevenlabs_request
  -> elevenlabs_audio
  -> heygen_avatar (optional)
  -> animation_plan
  -> resolved_timeline
  -> motion_canvas_render
  -> base_video
```

Each stage consumes persisted upstream artifacts and produces a persisted downstream artifact. Normal reruns reuse matching completed artifacts when the input hash is unchanged. Force reruns create a new version and mark affected downstream artifacts stale without deleting them.

The standard path still runs the blackboard video through Motion Canvas and produces a base video. `real_world_context` is an optional Lesson-tab enrichment that can be run from the logs after the deterministic lesson exists; it does not block or stale the video pipeline. HeyGen avatar generation is an optional paid stage that can be run from the logs after ElevenLabs audio exists; it should only make downstream render artifacts stale.

SymPy and deterministic Python code are the source of mathematical truth. LLMs can explain a completed lesson and choose semantic animation cues, but they must never invent roots, transformations, teaching-step IDs, or math-line IDs.

Read more in:

- [Architecture](docs/architecture.md)
- [Domain Model](docs/domain-model.md)
- [Video Pipeline](docs/video-pipeline.md)
- [Auth and Usage](docs/auth-and-usage.md)
- [Strategy](STRATEGY.md)

## Prerequisites

- Node.js with pnpm
- Python 3.12+ with uv
- Supabase CLI for local database work
- Chrome/Chromium and `ffmpeg` when running command-backed Motion Canvas renders

## Environment

Copy `.env.example` and app-specific `.env.example` files to local `.env` files. Only expose browser-safe values with the `NEXT_PUBLIC_` prefix.

The API must be running for equation submission and stage execution. If only the web app is running, the composer renders but stage calls fail with a fetch error.

Core provider settings:

```env
OPENAI_API_KEY=
OPENAI_SCRIPT_MODEL=gpt-5-mini
SCRIPT_GENERATION_ENABLED=true
SCRIPT_WORD_BUDGET=150

ELEVENLABS_API_KEY=
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
ELEVENLABS_COST_PER_CREDIT_USD=0.000165
```

Instructor voice IDs and HeyGen avatar IDs live in the global Supabase `instructors` table, not deployment environment variables. Use the instructor editor in the app, or update Supabase directly, to set those IDs.

Cost display and provider usage logging use these price settings:

```env
OPENAI_GPT5_MINI_INPUT_COST_PER_MILLION_TOKENS_USD=0.25
OPENAI_GPT5_MINI_OUTPUT_COST_PER_MILLION_TOKENS_USD=2.00
HEYGEN_API_KEY=
HEYGEN_AVATAR_DEFAULT_MODEL=avatar_iii
HEYGEN_AVATAR_III_COST_PER_SECOND_USD=0.0167
HEYGEN_AVATAR_IV_COST_PER_SECOND_USD=0.0667
HEYGEN_AVATAR_V_COST_PER_SECOND_USD=0.0667
NEXT_PUBLIC_HEYGEN_AVATAR_III_COST_PER_SECOND_USD=0.0167
NEXT_PUBLIC_HEYGEN_AVATAR_IV_COST_PER_SECOND_USD=0.0667
NEXT_PUBLIC_HEYGEN_AVATAR_V_COST_PER_SECOND_USD=0.0667
```

Generated media is stored in a private Supabase Storage bucket:

```env
GENERATED_MEDIA_BUCKET=generated-media
```

The API render stage calls Motion Canvas through a command adapter:

```env
MOTION_CANVAS_RENDER_COMMAND=pnpm --filter @quadratics/video render
MOTION_CANVAS_RENDER_CWD=
MOTION_CANVAS_RENDER_TIMEOUT_SECONDS=120
```

The render command receives `QUADRATICS_RENDER_INPUT_PATH` and `QUADRATICS_RENDER_OUTPUT_PATH`, downloads signed narration segment URLs when present, renders the scene, and assembles the MP4 with `ffmpeg`. If the API process does not run from the monorepo root, set `MOTION_CANVAS_RENDER_CWD` to the deployed monorepo root.

HeyGen credentials are normally stored as encrypted user-provided provider keys. `HEYGEN_API_KEY` is an API-server fallback for local/internal testing when no user key is stored. Set the encryption key before enabling in-app key saves:

```env
PROVIDER_KEYS_ENCRYPTION_KEY=
HEYGEN_AVATAR_OUTPUT_FORMAT=webm
HEYGEN_AVATAR_POLL_INTERVAL_SECONDS=10
HEYGEN_AVATAR_TIMEOUT_SECONDS=300
```

Generate a key with:

```sh
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

For avatar generation, the API downloads the completed narration audio from private storage, uploads it to HeyGen as an audio asset, and then creates the avatar video with `audio_asset_id`. This avoids giving HeyGen private Supabase signed URLs directly.

## Game Prototype

The `/game` route is an isolated prototype for the worksheet/game lesson direction. It keeps the normal Quadratics header, then renders a game-style character selection screen and arena. Sprint 1 uses local static prototype assets under `apps/web/public/game`, one unlocked PDF-backed lesson, one locked future lesson orb, account-scoped progress, and a redacted logs drawer.

The game prototype does not call OpenAI, ElevenLabs, HeyGen, Motion Canvas, or storage generation APIs. It is a UI/progress shell for the next worksheet-video work. Runtime game assets are served from the web app for speed; raw downloaded source ZIPs and local asset-ingestion folders should stay out of git unless an explicit asset-publishing task promotes optimized files into `apps/web/public/game`.

## Local Development

Install dependencies:

```sh
pnpm install
uv sync --project apps/api
```

Run the app:

```sh
pnpm api:dev
pnpm web:dev
```

Useful commands:

- `pnpm dev` - Run workspace dev tasks
- `pnpm video:dev` - Run the Motion Canvas editor at `http://localhost:9000`
- `pnpm video:fixture` - Validate/load the golden fixture without OpenAI or ElevenLabs calls
- `pnpm --filter @quadratics/video render` - Render from `QUADRATICS_RENDER_INPUT_PATH` to `QUADRATICS_RENDER_OUTPUT_PATH`
- `/game?preview=arena&fighter=mario` - Development-only shortcut for visually checking the game arena with a selected fighter
- `pnpm sb:link` - Link `infra/supabase` to the configured Supabase project
- `pnpm sb:push:dry` - Preview Supabase migration changes
- `pnpm sb:push` - Push Supabase migrations

Validation gates:

```sh
pnpm lint
pnpm typecheck
pnpm test
uv run --project apps/api pytest
```

## Manual Pipeline Workflow

The product intentionally favors step-by-step execution. Submit an equation to create or reopen the deterministic solution and lesson. Then use the small stage controls in the logs to run or rerun:

- `real_world_context`
- `teacher_script`
- `elevenlabs_request`
- `elevenlabs_audio`
- `heygen_avatar`
- `animation_plan`
- `resolved_timeline`
- `motion_canvas_render`

The `real_world_context` log generates the IRL Example copy shown under the Lesson tab graph. The `elevenlabs_request` log shows the exact conversation-ready text and break tags used to request audio. The `elevenlabs_audio` log shows the generated narration segments and playback controls. The final video belongs in the Lesson view; logs show the production process.

The `real_world_context` and `heygen_avatar` stages are optional and paid. Context generation contributes to the base and avatar average video cost because it is part of the lesson experience. The UI estimates HeyGen cost from completed narration duration before running it.

Submitting an equation reopens the latest matching generation for the same authenticated user, normalized equation, and instructor. This preserves completed artifacts across sessions and avoids repeated provider calls for problems a user has already generated.

## Deployment

The web app is intended for Vercel. The FastAPI service can run on Railway.

For API-only solving, scripting, and narration, deploying from `apps/api` is enough. For command-backed Motion Canvas rendering, deploy the full monorepo so the API process can access `apps/video`, the root `package.json`, `pnpm-lock.yaml`, Chrome/Chromium, and `ffmpeg`.

A typical Railway start command is:

```sh
uv run --project apps/api uvicorn app.main:app --app-dir apps/api --host 0.0.0.0 --port $PORT
```

## Current Scope

Quadratics currently supports quadratic equations only. The v0 teaching path builds factoring lessons for quadratics that factor cleanly over rational values. Other instructional methods should return an explicit unsupported-method state until they are implemented.
