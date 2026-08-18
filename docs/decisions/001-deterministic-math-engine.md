# 001. Deterministic Math Engine

## Decision

Use SymPy and deterministic code as the mathematical source of truth.

## Context

The product explains quadratic equations. Correctness must not depend on LLM output.

## Consequences

The API validates, normalizes, and solves equations before building lessons. LLMs may assist future narration only after math truth is established.
