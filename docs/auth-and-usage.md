# Auth and Usage

Supabase Auth owns password authentication. The product UI asks for a username and password, not an email address. The Next.js server action maps username `alice` to the internal Supabase Auth email `alice@quadratics.xyz`, then signs in with Supabase email/password auth. Operators can manually create accounts in Supabase by creating email/password users with that internal email format.

The `/app` UI shell is public so visitors can see the tool. Equation submission still requires an authenticated session, and API endpoints under `/api/v1` require API authorization. `/login` is not a standalone product surface; it redirects to `/app`, where the account menu contains the login form.

Generation ownership belongs to the authenticated user. API routes must verify the bearer token and load only that user's generation jobs, artifacts, and media references. Browser clients must never receive Supabase service-role credentials.

The product is currently an internal tool, so there is no user-facing credit system. The early `credit_ledger` schema and `/me` balance field still exist for compatibility with previous migrations/tests, but new pipeline work should optimize for provider-call reuse through artifacts instead of adding billing behavior.

Provider calls should be independently runnable and independently auditable. A script generation, speech-markup request, narration segment, animation-plan request, or video render should attach to a user-owned generation job and artifact attempt. Normal reruns should reuse matching completed artifacts. Force reruns should be explicit because they may call OpenAI, ElevenLabs, or the render stack again and stale downstream artifacts.

Email addresses and stored equation history are user data. Do not log bearer tokens, service-role keys, raw provider keys, or raw request bodies by default. Account/data deletion and retention policy need a follow-up decision before production launch.
