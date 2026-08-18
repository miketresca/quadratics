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

## Scope

The app currently supports quadratic equations only. SymPy is the source of mathematical truth. v0 builds instructional steps only for quadratics that factor cleanly over rational values.
