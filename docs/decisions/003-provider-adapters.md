# 003. Provider Adapters

## Decision

External script, voice, animation planning, avatar, and video/render providers must remain behind interfaces.

## Context

OpenAI, ElevenLabs, HeyGen, Motion Canvas render invocation, and future providers may change. Their SDK types and transport details should not leak into the lesson domain.

## Consequences

Core math and lesson code must not import provider SDKs. Provider outputs should cross the boundary as validated artifacts: teacher scripts, speech markup, narration metadata, animation plans, timelines, or render media references.
