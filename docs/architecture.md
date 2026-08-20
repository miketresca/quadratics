# Architecture

```text
User
  -> Next.js
  -> Supabase Auth
  -> FastAPI
  -> Auth / Usage Validation
  -> Artifact-backed Generation Pipeline
  -> Quadratic Parser / Validator
  -> SymPy Solver
  -> Instructional Strategy
  -> Lesson Model
  -> Optional Real-World Context Provider Boundary
  -> Script Provider Boundary
  -> Speech Markup Provider Boundary
  -> Narration Provider Boundary
  -> Animation Planner Provider Boundary
  -> Deterministic Timeline Resolver
  -> Render Provider Boundary
  -> Optional Avatar Provider Boundary
  -> Final Video
```

The LLM is not part of the mathematical truth path. SymPy validates equations, extracts coefficients, and computes exact roots. LLM-assisted script generation can happen only after the deterministic lesson model exists. The animation planner may choose semantic visual actions, but deterministic code validates references and resolves timestamps.

FastAPI protects API routes with Supabase bearer-token verification. Next.js renders the root `/` app shell and never exposes service-role credentials; authenticated actions still require Supabase session context.

## Game Route Boundary

The `/game` route is a separate product surface inside the same Next.js app. It reuses shared header/auth chrome and typed API-client patterns, but it does not import the quadratic equation form, lesson result, or pipeline log components for core rendering.

Sprint 1 game code is intentionally a UI/progress shell. The web app serves optimized local prototype assets from `apps/web/public/game`, renders character select and arena interactions in the browser, and opens a public PDF placeholder lesson. The API only persists authenticated user progress for selected fighter and lesson status; it does not run paid providers or worksheet generation stages for the game route yet.

Game progress is account-scoped and isolated from quadratic generation jobs. Public visitors can view the shell and redacted logs, but progress reads and mutations still require Supabase auth. Future worksheet generation should use a game/worksheet artifact namespace rather than overloading the quadratic generation pipeline before the contracts are proven.

## Pipeline Boundary

Generation orchestration is artifact-backed. Each stage reads persisted upstream artifacts, computes an input hash from material inputs and configuration, and either reuses a matching completed artifact or writes a new attempt. Rerunning a stage marks dependent current downstream artifacts stale without deleting them.

Provider-specific code belongs behind adapters:

- script and speech markup providers live under API provider/service boundaries
- real-world context lives behind a provider boundary and may only explain deterministic lesson facts
- ElevenLabs narration lives behind the narration provider boundary
- animation planning lives behind an animation-plan provider boundary
- rendering lives behind a render adapter so the API does not depend on Motion Canvas CLI details
- HeyGen/avatar work remains optional and should be skipped only by avatar-specific stages

## Shared Contracts

Lesson data is shared between API, web, and Motion Canvas. Teaching steps are the unit for script segments, narration segments, and animation cues. Math lines are deterministic transformations rendered inside a teaching step.

Animation uses two contracts:

- `AnimationPlan`: semantic cues, constrained primitives, targets, and narration trigger phrases
- `ResolvedAnimationTimeline`: exact narration spans, animation windows, and chalk-SFX windows

ElevenLabs alignment is the timestamp source of truth. The resolver maps planner trigger phrases to character-level alignment instead of asking another model to infer timings from audio.

## Current Implementation Note

The repository has both in-memory adapters for tests/unconfigured local runs and Supabase-backed adapters for generation jobs, artifacts, private media upload, and signed playback URLs. Rendering is behind a command adapter; when `MOTION_CANVAS_RENDER_COMMAND` is set, the API passes render input/output paths to the configured Motion Canvas command. Without that setting, tests and local development use the development renderer.
