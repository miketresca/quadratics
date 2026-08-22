# Codebase Cleanup Review

This note captures cleanup findings from the `building-lesson-1-a-z` worksheet-template branch. It is intentionally a follow-up list, not a refactor plan to execute all at once.

## Findings

1. `apps/web/components/game/game-worksheet-renderer.ts` currently duplicates Lesson 1 fill target metadata and expected answers that also exist in `apps/api/app/services/game_lessons/templates/volume_cubes_lesson_1.py`.

   This was useful to escape stale generated bundle coordinates during page-template iteration, but it should not become the long-term source of truth. The renderer should own visual layout coordinates; answer keys and semantic fill target metadata should come from the lesson template or a shared typed built-in lesson definition.

2. Guided Example answer keys are the highest-risk duplicate.

   The API template still carries older values for several `fill_guided_*` targets, while the browser renderer now carries values matched to the current hand-built table. Do not enable final Guided Example validation until this is reconciled.

3. `apps/web/components/game/game-shell.tsx` is still the main orchestration pressure point.

   It owns scene lifecycle, focus routing, laptop pipeline state, worksheet playback, music bridge state, auth-dependent actions, and persistence calls. Future cleanup should extract behavior in small pieces only when a feature touches that area. Good candidates are worksheet playback/input orchestration and laptop mode routing.

4. Laptop rendering has parallel DOM and React surfaces.

   `game-laptop-screen.ts` builds the in-scene CSS3D laptop DOM while `game-laptop-panels.tsx` renders the focused React overlay. The future teacher/student split should avoid duplicating tab definitions, labels, and mode-specific visibility rules across both files.

5. Local artifacts should stay out of source.

   The repo now ignores generated worksheet page PNGs, Motion Canvas timestamp temp files, local progress videos, local task PDFs, and loose raw assets under `assets/`. Curated runtime assets should live under intentional public paths with README context. Resumable handoff notes are not local artifacts; keep them in `docs/handoffs/` when they are useful for future agents.

## Recommended Cleanup Sequence

1. Define a typed built-in lesson registry for the three predefined lessons.
2. Move answer keys, input constraints, section definitions, and semantic IDs into that registry or make the API template the single generated source consumed by the renderer.
3. Keep renderer section modules focused on layout and drawing: `DoNowTemplate`, `VocabularyTemplate`, and `GuidedExampleTemplate`.
4. Extract worksheet keyboard/click/check-answer orchestration out of `game-shell.tsx` once the three section templates stabilize.
5. Introduce an explicit laptop mode model: `student` versus `teacher`, then share tab definitions between CSS3D and React laptop surfaces.
