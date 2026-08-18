# Supabase Setup

Migrations live in `infra/supabase/migrations`.

For local development, start Supabase through the Supabase CLI from this directory or apply the SQL migration to a Supabase project. The API uses Supabase Auth tokens for authorization and keeps service-role credentials server-side only.

The v0 API provisions profiles and default generation credits from application code. The ledger remains the source of truth for credit balance.
