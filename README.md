# Quadratics

Quadratics generates short educational videos that explain how to solve quadratic equations. The current system supports authenticated users, deterministic SymPy solving, factoring lesson steps, teacher scripts, ElevenLabs narration, artifact-backed stage reruns, semantic animation planning, resolved timing, and a data-driven Motion Canvas blackboard renderer.

## Structure

- `apps/web` - Next.js App Router web app
- `apps/api` - FastAPI API and deterministic math engine
- `apps/video` - Motion Canvas blackboard renderer
- `packages/types` - Shared lesson/API TypeScript contracts
- `packages/config` - Shared app configuration such as instructor placeholders
- `infra/supabase` - Supabase migrations and setup notes
- `docs` - Architecture, domain, pipeline, usage, ADRs, and plans

## Prerequisites

- Node.js with pnpm
- Python 3.12+ with uv
- Supabase CLI for local database work

## Environment

Copy `.env.example` and app-specific `.env.example` files to local `.env` files. Browser variables must use the `NEXT_PUBLIC_` prefix only when they are safe to expose.

The API must be running for equation submission to work. If only the web app is running, the composer will render but submit will show a fetch failure.

The app shell at `/app` is public. Users must sign in with a real Supabase account before submitting an equation or managing API keys. The login widget asks for a username and password; internally, the server action maps username `alice` to the Supabase Auth email `alice@quadratics.xyz`. To create a login manually in Supabase, create an email/password user with that internal email format and give the user only the username.

Script generation is disabled by default and falls back to a deterministic development script so local UI work does not require provider credentials. To use the OpenAI-backed script provider, set:

```env
OPENAI_API_KEY=
OPENAI_SCRIPT_MODEL=gpt-5-mini
SCRIPT_GENERATION_ENABLED=true
SCRIPT_WORD_BUDGET=150
```

Script generation is narration text only. The pipeline then prepares that script for ElevenLabs as conversational speech markup and requests MP3 audio with character timing metadata.

The current `Audio only` UI label means no optional AI instructor avatar. It still produces the core blackboard video pipeline: lesson, script, narration, animation plan, resolved timeline, Motion Canvas render, and base video artifact.

ElevenLabs uses the platform API key and per-instructor voice IDs from the API service environment:

```env
ELEVENLABS_API_KEY=
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
ELEVENLABS_MALE_VOICE_ID=
ELEVENLABS_FEMALE_VOICE_ID=
```

Generated media uses the private Supabase Storage bucket configured by:

```env
GENERATED_MEDIA_BUCKET=generated-media
```

The API render stage calls a command-backed Motion Canvas renderer when configured:

```env
MOTION_CANVAS_RENDER_COMMAND=pnpm --filter @quadratics/video render
MOTION_CANVAS_RENDER_CWD=
MOTION_CANVAS_RENDER_TIMEOUT_SECONDS=120
```

The render command receives `QUADRATICS_RENDER_INPUT_PATH` and `QUADRATICS_RENDER_OUTPUT_PATH` from the API, renders Motion Canvas frames headlessly, downloads signed narration segment URLs when present, and assembles an MP4 with `ffmpeg`. If the API process does not run from the monorepo root, set `MOTION_CANVAS_RENDER_CWD` to the deployed monorepo root before invoking the render command.

HeyGen keys are user-provided through the account menu API key modal. They are encrypted server-side and stored in Supabase. Set this Railway API environment variable before enabling saves:

```env
PROVIDER_KEYS_ENCRYPTION_KEY=
```

Generate the value with:

```sh
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

## Commands

- `pnpm install` - Install workspace dependencies
- `uv sync --project apps/api` - Install API dependencies
- `pnpm dev` - Run workspace dev tasks
- `pnpm web:dev` - Run Next.js
- `pnpm api:dev` - Run FastAPI
- `pnpm video:dev` - Run Motion Canvas
- `pnpm video:fixture` - Validate and load the golden local video fixture without OpenAI or ElevenLabs calls
- `pnpm --filter @quadratics/video render` - Render Motion Canvas from `QUADRATICS_RENDER_INPUT_PATH` to `QUADRATICS_RENDER_OUTPUT_PATH`
- `pnpm sb:login` - Authenticate the local Supabase CLI
- `pnpm sb:link` - Link `infra/supabase` to the configured Supabase project
- `pnpm sb:push:dry` - Preview Supabase migration changes
- `pnpm sb:push` - Push Supabase migrations
- `pnpm lint` - Run lint gates
- `pnpm typecheck` - Run TypeScript checks
- `pnpm test` - Run TypeScript tests
- `uv run --project apps/api pytest` - Run API tests

Use `http://localhost:3000` for the web app. `http://localhost:9000` is the Motion Canvas editor.

## Pipeline

Generation is artifact-backed. The API can create a generation, run one stage, and return a snapshot of versioned artifacts. The UI is intentionally step-by-step so each boundary can be inspected before the next provider/render stage runs. Current stages are:

```text
solution -> lesson -> teacher_script -> elevenlabs_request -> elevenlabs_audio -> animation_plan -> resolved_timeline -> motion_canvas_render -> base_video
```

Normal stage reruns reuse matching completed artifacts. Force reruns create a new artifact version and mark affected downstream artifacts stale. The UI currently keeps progression manual and does not expose the old A-to-Z control or ElevenLabs audio regeneration controls, so animation plans and renders can be regenerated repeatedly without calling ElevenLabs again.

The golden fixture uses `x^2 + 5x + 6 = 0` and is the preferred workflow for iterating on Motion Canvas/chalk behavior without provider credentials.

## Deployment

The web app is intended to run on Vercel. The FastAPI service can run on Railway. For API-only solving and narration, service root directory `apps/api` is enough. For command-backed Motion Canvas rendering, deploy the full monorepo so Railway has `apps/video`, the root `package.json`, `pnpm-lock.yaml`, Chrome, and `ffmpeg` available to the API process. In that setup, use a start command like:

```sh
uv run --project apps/api uvicorn app.main:app --app-dir apps/api --host 0.0.0.0 --port $PORT
```

## Scope

The app currently supports quadratic equations only. SymPy is the source of mathematical truth. v0 builds instructional steps only for quadratics that factor cleanly over rational values.
