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

FastAPI protects API routes with Supabase bearer-token verification. Next.js protects `/app` with Supabase session checks and never exposes service-role credentials.

## Pipeline Boundary

Generation orchestration is artifact-backed. Each stage reads persisted upstream artifacts, computes an input hash from material inputs and configuration, and either reuses a matching completed artifact or writes a new attempt. Rerunning a stage marks dependent current downstream artifacts stale without deleting them.

Provider-specific code belongs behind adapters:

- script and speech markup providers live under API provider/service boundaries
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

The repository now has in-memory artifact/media repositories and a development render adapter for local iteration and tests. The Supabase migration defines the durable artifact shape, but production persistence, private object storage, signed playback URLs, and real Motion Canvas render invocation still need to replace the development adapters.
