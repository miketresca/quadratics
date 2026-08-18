# 003. Provider Adapters

## Decision

External voice, avatar, and video providers must remain behind interfaces.

## Context

ElevenLabs, HeyGen, and future providers may change. Their SDK types should not leak into the lesson domain.

## Consequences

Core math and lesson code must not import provider SDKs. Real provider modules should be added only when an integration task supplies contract pressure.
