---
artifact_contract: "ce-handoff/v1"
created_at: "2026-08-22T20:31:55Z"
title: "Lesson 1 interactive worksheet next session"
summary: "Fresh-session handoff for continuing Lesson 1 worksheet interactivity after the branch was merged to main."
keywords: ["quadratics", "worksheet-pov", "lesson-1", "interactive-lesson", "handoff"]
cwd: "/Users/mike/hub/apps/quadratics"
resume_focus: "Make every Lesson 1 page fully interactive, with scoring, validation, and section completion behavior."
repository: "quadratics"
repo_root_sha: "4792270c55f066ab01d00d255b838563ed916efd"
branch: "building-lesson-1-a-z"
head: "501750089d34dd6e491302663c8e947cf8c397f5"
worktree_path: "/Users/mike/hub/apps/quadratics"
---

# Lesson 1 Interactive Worksheet Handoff

The current branch is `building-lesson-1-a-z` at `5017500`. This branch has already been merged into `main` with merge commit `f2d1e85`, then the worktree was switched back to `building-lesson-1-a-z` so development can continue here. The worktree was clean when this handoff was created.

The root `/` experience is the Worksheet POV Lab: a 3D study-room scene with an in-world paper worksheet, laptop, music, timer, visitor map, and phone. Lesson 1 is now moving away from PDF-rendered pages toward structured built-in lesson templates. The paper focus camera is currently in a good top-down state; do not change it unless the user explicitly asks. The Do Now page is considered visually and functionally good by the user. Vocabulary and Guided Example base templates have been shaped, but the next step is to make the full Lesson 1 experience truly interactive.

## Where To Look First

- `AGENTS.md` for project rules and the current docs map.
- `docs/backlog/to-do.md` for the living backlog, especially Lesson 1 completion/state work.
- `docs/templates/worksheet-page-templates.md` for the worksheet page-template direction and constraints.
- `docs/reviews/codebase-cleanup-review.md` for known cleanup/refactor risks, especially duplicated lesson answer metadata.
- `apps/web/components/game/AGENTS.md` for game-scene conventions and validation expectations.
- `apps/web/components/game/game-worksheet-renderer.ts` for the current paper renderer, input lines, validation drawing, and section templates.
- `apps/web/components/game/game-shell.tsx` for worksheet focus/input orchestration and progress persistence.
- `apps/api/app/services/game_lessons/templates/volume_cubes_lesson_1.py` for the backend Lesson 1 semantic template and answer data.
- `apps/web/tests/game-worksheet-renderer.test.ts` for renderer behavior coverage.

## Current Product Direction

The next session should start by making Lesson 1 fully interactive across every page. The user specifically wants to count scores, validate typed answers, track each section independently, and eventually mark Lesson 1 complete only when the section completion rules are satisfied. Do Now already has click-to-type worksheet lines, input constraints, enter-to-next-line behavior, validation highlights, and check-answer behavior. Continue from that pattern for Vocabulary and Guided Example rather than reintroducing PDF crops or web-form-style inputs.

Lesson 1 has three persistent sections: `Do Now`, `Vocabulary`, and `Guided Example`. The top tabs stay visible on every section. The long-term model should let future built-in lessons reuse the same components and change only lesson title/topic, section content, diagrams, fill target IDs, answer keys, explanation metadata, and scoring rules.

## Important Cautions

- The user likes the current top-down paper focus view. Avoid camera changes.
- Do not resume the old PDF-as-layout approach. The PDF is now only reference material, exposed as `Open reference PDF`.
- The renderer still duplicates some Lesson 1 fill target metadata and expected answers that also exist in the API template. Before enabling final scoring across all sections, reconcile this into one source of truth or keep any renderer fallback explicitly temporary.
- `game-shell.tsx` is large and owns a lot of orchestration. Prefer focused extraction only when it directly supports the next interaction feature.
- The laptop is planned to split into student and teacher modes later. Do not remove the teacher/debug pipeline surface while polishing the student worksheet.

## Recent Verification

Recent cleanup and template commits passed:

- `pnpm --filter @quadratics/web test -- game-assets.test.ts`
- `pnpm typecheck`
- `pnpm --filter @quadratics/web typecheck`
- `git diff --check`

For the next interaction pass, add or update focused tests that prove each worksheet input can be clicked, accepts only allowed characters, respects character limits, advances correctly with Enter, and reports correct/incorrect/empty validation state.
