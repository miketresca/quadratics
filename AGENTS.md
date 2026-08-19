# Quadratics Agent Guide

This repository builds an internal, artifact-backed video generation pipeline for quadratic lessons. Start with this file for project-wide rules, then read the scoped guide for the area you are touching.

## Where To Look

- [README.md](README.md) - capabilities, setup, environment, commands, and deployment notes
- [STRATEGY.md](STRATEGY.md) - product direction, priorities, and non-goals
- [docs/architecture.md](docs/architecture.md) - system boundaries and data flow
- [docs/domain-model.md](docs/domain-model.md) - shared vocabulary and artifact concepts
- [docs/video-pipeline.md](docs/video-pipeline.md) - generation stages, reruns, storage, rendering, and golden checkpoint behavior
- [docs/auth-and-usage.md](docs/auth-and-usage.md) - auth, ownership, provider keys, and Supabase expectations
- [docs/decisions](docs/decisions) - accepted architectural decisions
- [docs/solutions](docs/solutions) - durable notes from solved issues

Scoped guides:

- [apps/api/AGENTS.md](apps/api/AGENTS.md) for FastAPI, math, providers, artifacts, storage, and rendering orchestration
- [apps/web/AGENTS.md](apps/web/AGENTS.md) for Next.js, auth UI, lesson preview, and pipeline logs
- [apps/video/AGENTS.md](apps/video/AGENTS.md) for Motion Canvas rendering and video composition

## Product Boundaries

This app supports quadratic equations only. Do not broaden the math scope without an explicit task.

The v0 teaching experience is a factoring lesson generator. Valid quadratics that need another instructional method may be solved mathematically, but the lesson builder must return an explicit unsupported-method state instead of fake teaching steps.

## Mathematical Truth

SymPy and deterministic Python code are the source of mathematical truth. LLM output must never determine whether an equation, root, coefficient, or transformation is correct.

LLMs may write instructional language or choose semantic animation cues after the deterministic lesson exists. They must reference existing teaching-step and math-line IDs and must not introduce new math.

## Artifact Pipeline

The pipeline is a build system:

```text
solution -> lesson -> teacher_script -> elevenlabs_request -> elevenlabs_audio -> heygen_avatar (optional) -> animation_plan -> resolved_timeline -> motion_canvas_render -> base_video
```

Every stage should consume persisted upstream artifacts and produce a persisted downstream artifact. Reruns should reuse matching completed artifacts unless force regeneration is explicit. Replacing an upstream artifact should mark affected downstream artifacts stale rather than deleting them.

`heygen_avatar` is an optional paid stage after ElevenLabs audio exists. The standard pipeline still produces the Motion Canvas base video; optional avatar work should only stale downstream render artifacts.

## Provider Isolation

Provider-specific SDK calls belong behind provider or adapter boundaries. Core math and lesson code must not import OpenAI, ElevenLabs, HeyGen, Supabase Storage, or Motion Canvas command details directly.

## Code Comments

New code should include concise, useful comments where they help a future reader understand intent, control flow, external contracts, or non-obvious tradeoffs. Use the idiomatic comment style for the language being edited. Do not narrate obvious syntax, but do leave short orientation comments for functions, methods, files, or complex blocks whose purpose would otherwise take time to reconstruct.

## Authentication And Security

The root `/` app shell may render publicly, but equation submission, generation access, provider key management, and user-owned data require authentication. API authorization is mandatory. Never trust frontend-only authorization.

Never expose Supabase service-role credentials client-side. User-owned records must be protected by API authorization and Supabase RLS. Do not log bearer tokens, service-role keys, provider keys, or raw provider request bodies by default.

The credit ledger is legacy scaffold infrastructure. Do not expand it or make new product behavior depend on it unless the user explicitly asks.

## Validation

Before completing code changes, run the relevant tests plus root validation where practical:

```sh
pnpm lint
pnpm typecheck
pnpm test
uv run --project apps/api pytest
```

For docs-only changes, run at least the checks that are lightweight and relevant to edited docs. Do not include local generated videos or Motion Canvas metadata churn in documentation commits unless the task explicitly asks for those artifacts.
