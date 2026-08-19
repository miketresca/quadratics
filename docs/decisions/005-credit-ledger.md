# 005. Credit Ledger

## Decision

Track generation allowance through an auditable ledger rather than only a mutable balance field.

## Context

The product will eventually charge for expensive generation. Usage history must remain auditable.

## Consequences

Balances are derived from ledger entries. One-time grants use idempotency keys to prevent duplicate credits.

Expensive generation is not one monolithic event. Teacher-script generation, speech-markup formatting, narration segment generation, avatar generation, and video rendering may all become separate billable attempts. Each attempt should be tied to a user-owned generation job and an idempotent credit-ledger entry before production usage charging is enabled.

Manual pipeline controls are allowed and expected during development. They reduce accidental provider spend by letting users run only the next step or retry one narration segment instead of regenerating the whole pipeline.
