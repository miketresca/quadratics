# 004. Supabase Auth

## Decision

Use Supabase Auth for user authentication and protect both frontend routes and FastAPI endpoints.

## Context

The scaffold needs email/password auth and persistent sessions without a custom credential system.

## Consequences

Next.js manages Supabase sessions. FastAPI verifies bearer tokens and derives the authenticated user before protected work.
