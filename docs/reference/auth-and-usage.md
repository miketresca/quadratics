# Auth and Usage

Supabase Auth owns password authentication. The product UI asks for a username and password, not an email address. The Next.js server action maps username `alice` to the internal Supabase Auth email `alice@quadratics.xyz`, then signs in with Supabase email/password auth. Operators can manually create accounts in Supabase by creating email/password users with that internal email format.

The root `/` UI shell is the public worksheet POV lab so visitors can see the current product direction. The original quadratic equation workflow lives at `/v1`. Equation submission, game lesson generation, provider key management, and user-owned data still require an authenticated session, and API endpoints under `/api/v1` require API authorization. `/login` is a compatibility route for auth actions, not a standalone product surface.

Generation ownership belongs to the authenticated user. API routes must verify the bearer token and load only that user's generation jobs, artifacts, and media references. Browser clients must never receive Supabase service-role credentials.

The product is currently an internal tool, so there is no user-facing credit system. The early `credit_ledger` schema and `/me` balance field still exist for compatibility with previous migrations/tests, but new pipeline work should optimize for provider-call reuse through artifacts instead of adding billing behavior.

Provider calls should be independently runnable and independently auditable. A script generation, speech-markup request, narration segment, optional HeyGen avatar clip, animation-plan request, or video render should attach to a user-owned generation job and artifact attempt. Normal reruns should reuse matching completed artifacts. Force reruns should be explicit because they may call OpenAI, ElevenLabs, HeyGen, or the render stack again and stale downstream artifacts.

`real_world_context` is also a paid OpenAI-backed artifact. It enriches the Lesson tab rather than the video render, but its token usage should still count toward user spend and the base/with-avatar average lesson cost because it is part of the generated learning experience.

Email addresses and stored equation history are user data. Do not log bearer tokens, service-role keys, raw provider keys, or raw request bodies by default. Account/data deletion and retention policy need a follow-up decision before production launch.
