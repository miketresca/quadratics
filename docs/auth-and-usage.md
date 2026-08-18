# Auth and Usage

Supabase Auth owns email/password authentication. The browser receives a Supabase access token and sends it to FastAPI as a bearer token. FastAPI verifies the token and derives `user_id` before protected work.

Only `/login` is public in the web app. `/app` requires an authenticated session. API endpoints under `/api/v1` require API authorization.

Generation credits are ledger-based. `credit_ledger` is the auditable source of truth, and balances are derived by summing entries for one user. Default demo credits use an idempotency key so first-login provisioning cannot double-grant credits.

Solving an equation, generating a lesson, and generating expensive media are separate cost concepts. The deterministic solve endpoint does not consume generation credits in v0.

Email addresses and stored equation history are user data. Do not log bearer tokens, service-role keys, or raw request bodies by default. Account/data deletion and retention policy need a follow-up decision before production launch.
