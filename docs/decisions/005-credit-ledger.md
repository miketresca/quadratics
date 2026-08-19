# 005. Credit Ledger

## Status

Superseded for the current internal-app direction.

## Previous Decision

The initial scaffold tracked generation allowance through an auditable ledger rather than only a mutable balance field. That was useful when the product direction assumed user-facing credits and billing.

## Current Decision

Quadratics is currently an internal tool for a small trusted audience. Do not add new user-facing credit or billing behavior to the generation pipeline.

The legacy `credit_ledger` table, `/me` balance field, and tests may remain temporarily for migration compatibility, but new pipeline work should focus on artifact reuse:

- do not rerun OpenAI if the script or animation plan artifact can be reused
- do not rerun ElevenLabs if the speech text, voice, model, and settings match an existing narration artifact
- do not rerender unless the resolved timeline or render configuration changed, or the user explicitly reruns render

## Consequences

Provider-call avoidance is handled by artifact input hashes and stale propagation, not by a user-visible credit ledger.

Future billing, quotas, or cost controls require a fresh decision before being added back to the product.
