# Quadratics Agent Guide

## Product Boundaries

This app currently supports quadratic equations only. Do not broaden the math scope without an explicit task.

The v0 teaching experience is a factoring lesson generator. Valid quadratics that need another instructional method may be solved mathematically, but the lesson builder must return an explicit unsupported-method state instead of fake steps.

## Mathematical Truth

SymPy and deterministic Python code are the source of mathematical truth. LLM output must never determine whether an equation, root, coefficient, or transformation is correct.

## Lesson Architecture

Mathematical operations and teaching steps are different concepts. Teaching steps are the unit for narration, animation timing, optional avatar composition, and video segments. Math lines are deterministic transformations rendered inside a teaching step.

Script generation sits after deterministic lesson construction. Script segments may use an LLM to explain a completed factoring lesson, but they must reference existing teaching-step and math-line IDs and must not introduce new math.

## Provider Isolation

OpenAI script generation belongs behind a `ScriptProvider`. ElevenLabs belongs behind a future `NarrationProvider`. HeyGen belongs behind a future `AvatarProvider`. Future video providers belong behind adapters. Core math and lesson code must not import provider-specific SDKs or provider modules.

## Authentication and Usage

Application routes require authentication except `/login`. API authorization is mandatory. Never trust frontend-only authorization.

Generation ownership always belongs to a user. The credit ledger is the auditable source of usage changes. Do not mutate balances directly without recording a ledger transaction.

## Security

Never expose Supabase service-role credentials client-side. User-owned records must be protected by API authorization and Supabase RLS. Do not log bearer tokens, service-role keys, or raw request bodies by default.

## Repository Conventions

Frontend code belongs in `apps/web`. API routes belong in `apps/api/app/api/routes`. Math domain logic belongs in `apps/api/app/services/math`. Lesson construction belongs in `apps/api/app/services/lessons`. Script orchestration belongs in `apps/api/app/services/scripts`, with provider adapters under `apps/api/app/providers`. Database migrations belong in `infra/supabase/migrations`. Motion Canvas code belongs in `apps/video`.

Before completing a task, run the relevant tests plus root validation where practical: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `uv run --project apps/api pytest`.
