# Supabase Setup

Migrations live in `infra/supabase/migrations`.

For local development, start Supabase through the Supabase CLI from this directory or apply the SQL migration to a Supabase project. The API uses Supabase Auth tokens for authorization and keeps service-role credentials server-side only.

The v0 API provisions profiles and default generation credits from application code. The ledger remains the source of truth for credit balance.

## Remote Project Push

Install dependencies, then authenticate once:

```sh
pnpm install
pnpm sb:login
```

Create a local `.env.supabase` file from `.env.supabase.example` and set:

```env
SUPABASE_PROJECT_REF=your-project-ref
```

Then link and push migrations:

```sh
pnpm sb:link
pnpm sb:push:dry
pnpm sb:push
```

Use `SUPABASE_PROJECT_REF_DEV` or `SUPABASE_PROJECT_REF_PROD` with `pnpm sb:link:dev` / `pnpm sb:link:prod` when you add multiple Supabase environments.
