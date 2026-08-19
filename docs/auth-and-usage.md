# Auth and Usage

Supabase Auth owns password authentication. The product UI asks for a username and password, not an email address. The Next.js server action maps username `alice` to the internal Supabase Auth email `alice@quadratics.xyz`, then signs in with Supabase email/password auth. Operators can manually create accounts in Supabase by creating email/password users with that internal email format.

The `/app` UI shell is public so visitors can see the tool. Equation submission still requires an authenticated session, and API endpoints under `/api/v1` require API authorization. `/login` is not a standalone product surface; it redirects to `/app`, where the account menu contains the login form.

Generation credits are ledger-based. `credit_ledger` is the auditable source of truth, and balances are derived by summing entries for one user. Default demo credits use an idempotency key so first-login provisioning cannot double-grant credits.

Solving an equation, generating a teacher script, formatting speech markup, and generating expensive media are separate cost concepts. The deterministic solve endpoint does not consume generation credits in v0.

Expensive provider calls should be independently runnable and independently auditable. A script generation, speech-markup request, narration segment, avatar clip, or video render should attach to a user-owned generation job and a ledger entry with an idempotency key before it becomes a production billing event. Manual retries must not mutate balances directly or double-charge the same provider attempt.

Email addresses and stored equation history are user data. Do not log bearer tokens, service-role keys, or raw request bodies by default. Account/data deletion and retention policy need a follow-up decision before production launch.
