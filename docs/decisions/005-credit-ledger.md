# 005. Credit Ledger

## Decision

Track generation allowance through an auditable ledger rather than only a mutable balance field.

## Context

The product will eventually charge for expensive generation. Usage history must remain auditable.

## Consequences

Balances are derived from ledger entries. One-time grants use idempotency keys to prevent duplicate credits.
