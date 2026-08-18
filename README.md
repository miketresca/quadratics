# Quadratics

Quadratics is a scaffold for generating short educational videos that explain how to solve quadratic equations. The first slice supports authenticated users, deterministic SymPy solving, factoring lesson steps, and a Motion Canvas proof-of-concept scene.

## Structure

- `apps/web` - Next.js App Router web app
- `apps/api` - FastAPI API and deterministic math engine
- `apps/video` - Motion Canvas proof-of-concept renderer
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

For local UI work before Supabase is configured, set:

```env
NEXT_PUBLIC_DEV_AUTH_BYPASS=true
DEV_AUTH_BYPASS=true
```

Then run the API and web app with `pnpm dev`. The web app uses `Bearer dev`, and the API accepts it only when `DEV_AUTH_BYPASS=true` in a local development environment.
Keep `DEV_AUTH_BYPASS=false` outside local development; production-mode API requests using `Bearer dev` must be rejected.

The API must be running for equation submission to work. If only the web app is running, the composer will render but submit will show a fetch failure.

The app shell at `/app` is public. Users must sign in only when they submit an equation. The login widget asks for a username and password; internally, the server action maps username `alice` to the Supabase Auth email `alice@quadratics.xyz`. To create a login manually in Supabase, create an email/password user with that internal email format and give the user only the username.

Script generation is disabled by default and falls back to a deterministic development script so local UI work does not require provider credentials. To use the OpenAI-backed script provider, set:

```env
OPENAI_API_KEY=
OPENAI_SCRIPT_MODEL=gpt-5-mini
SCRIPT_GENERATION_ENABLED=true
SCRIPT_WORD_BUDGET=150
```

Script generation is narration text only. It does not call ElevenLabs, HeyGen, or Motion Canvas.

ElevenLabs will use the platform API key from the API service environment:

```env
ELEVENLABS_API_KEY=
```

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
- `pnpm lint` - Run lint gates
- `pnpm typecheck` - Run TypeScript checks
- `pnpm test` - Run TypeScript tests
- `uv run --project apps/api pytest` - Run API tests

Use `http://localhost:3000` for the web app. `http://localhost:9000` is the Motion Canvas editor.

## Deployment

The web app is intended to run on Vercel. The FastAPI service can run on Railway with service root directory `apps/api`, no custom build command, and start command:

```sh
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

## Scope

The app currently supports quadratic equations only. SymPy is the source of mathematical truth. v0 builds instructional steps only for quadratics that factor cleanly over rational values.
