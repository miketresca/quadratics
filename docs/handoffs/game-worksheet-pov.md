---
artifact_contract: "ce-handoff/v1"
created_at: "2026-08-22T07:17:04Z"
title: "Worksheet POV Lab handoff"
summary: "Fresh-thread handoff for continuing the Worksheet POV Lab paper-section lesson work without carrying the long chat history."
keywords: ["quadratics", "worksheet-pov", "game", "lesson-pipeline", "handoff"]
cwd: "/Users/mike/hub/apps/quadratics"
resume_focus: "Restore the flat paper worksheet interaction, fix progress persistence, and continue Lesson 1 pipeline/playback work from the current dirty main worktree."
repository: "quadratics"
repo_root_sha: "4792270c55f0"
branch: "main"
head: "9d6a9a6"
worktree_path: "/Users/mike/hub/apps/quadratics"
---

# Worksheet POV Lab Handoff

## Current User Intent

The user wants to start a fresh thread because this thread and the game files have become too large and slow to work in. The next thread should continue from the repo state, not from the full chat history.

The immediate product direction is:

- Keep `/` as the Worksheet POV Lab game experience.
- Keep the original Quadratics app on `/v1`.
- Stop using the OpenBook GLB/book view for the lesson worksheet.
- Return to a single flat paper on the desk.
- When Lesson 1 opens, render one worksheet section at a time on the flat paper:
  - `Do Now`
  - `Vocabulary`
  - `Guided Practice`
- Keep the pen cursor behavior on the paper.
- Do not switch the worksheet into a browser-style overlay like the laptop.

## Current Worktree State

Captured on branch `main` at `9d6a9a6`.

The worktree is dirty. Do not assume these changes are committed or stable. Before editing, run:

```sh
git status --short
```

Current dirty paths observed:

- `apps/api/app/services/game/catalog.py`
- `apps/api/app/services/game/progress.py`
- `apps/api/app/services/game_lessons/repository.py`
- `apps/api/app/services/game_lessons/templates/volume_cubes_lesson_1.py`
- `apps/web/components/game/game-desk-surface.ts`
- `apps/web/components/game/game-scene-config.ts`
- `apps/web/components/game/game-shell.tsx`
- `apps/web/components/game/game-textures.ts`
- `apps/web/components/game/game-worksheet-props.ts`
- `apps/web/components/game/game-worksheet-renderer.ts`
- `apps/web/lib/game/progress-client.ts`
- `apps/web/public/game/lessons/volume-cubes/pages/` untracked
- `assets/` untracked
- `docs/todo.md` untracked
- `infra/supabase/migrations/0012_game_progress_lesson_ids.sql` untracked
- `misc/progress/` untracked
- `misc/task/` untracked

Do not delete `assets/`, `misc/`, worksheet page images, or user-added media. The user has repeatedly said miscellaneous videos/assets are important.

## Important Current Bugs / Reverts Needed

### 1. Restore Flat Paper Section Flow

The user rejected the recent book/GLB and browser-style worksheet approaches. The desired interaction is the earlier paper mode, but with section-sized PDF/image crops so the content is readable.

Current target behavior:

1. The desk shows a normal flat paper.
2. The start paper has Lesson 1, Lesson 2, and Lesson 3 choices.
3. Lesson 2 and Lesson 3 remain locked/greyed out.
4. Lesson 1 should only open after the final published/bundle pipeline stage is complete.
5. When Lesson 1 opens, the paper shows a section selector for Do Now, Vocabulary, and Guided Practice.
6. Clicking a section renders only that section crop on the paper.
7. Typed answer boxes and audio/info icons are overlaid on the crop.
8. The pen remains the interactive cursor. The user specifically does not want a browser overlay here.

The source page images are in:

- `apps/web/public/game/lessons/volume-cubes/pages/page-1.png`
- `apps/web/public/game/lessons/volume-cubes/pages/page-2.png`

The current renderer file to inspect first:

- `apps/web/components/game/game-worksheet-renderer.ts`

Useful anchors from the current file:

- `WORKSHEET_PAGE_IMAGES` near line 31
- `WORKSHEET_SECTION_RECTS` near line 36
- `drawWorksheet` near line 83
- `drawGeneratedWorksheet` near line 171
- `drawSourceWorksheetPage` near line 310
- `worksheetFillTargetAtCanvasPoint` near line 464
- `canvasRectForTarget` near line 519
- `pageRectForPageId` near line 684
- `worksheetActionAtCanvasPoint` near line 738

Earlier there was a runtime error:

```text
ReferenceError: pageRectForPageId is not defined
```

That specific symbol now appears to exist, so do not blindly fix the old error. Inspect the current implementation and align it with the flat-paper section flow.

### 2. Fix Game Progress Storage 400

The user hit this runtime error when loading a lesson:

```text
Game progress storage request failed: 400:
null value in column "status" of relation "game_user_lesson_progress" violates not-null constraint
```

Likely file:

- `apps/api/app/services/game/progress.py`

Useful anchors:

- `_copy_lesson_progress` near line 401
- `_lesson_progress_values` near line 423

The likely issue is that copied lesson progress can preserve a null status. Ensure status defaults to `"started"` anywhere progress is written or copied. There is already a default in `_lesson_progress_values`; check `_copy_lesson_progress`.

### 3. Worksheet Fidelity

The user wants the worksheet to visually match the real PDF sections, not a generic regenerated worksheet. Use the existing page PNGs/crops where practical. The user is okay with image crops plus overlayed input boxes/buttons.

The source worksheet has two pages:

- Page 1: header, Do Now, Vocabulary
- Page 2: Guided Practice table

The user wants the section flow so the paper can show one readable section at a time rather than a full two-page spread.

## Broader Backlog

There are two backlog files right now:

- `docs/todo.md` currently contains the immediate restore-flat-paper task.
- `docs/to-do.md` contains the broader Worksheet POV Lab backlog.

Before doing new feature work, reconcile these if useful. Do not delete either file without user approval.

Current broader items from `docs/to-do.md`:

- Reusable incorrect-answer explanation flow.
- Polish Lesson 1 interactive worksheet experience.
- Phone reward and Easter egg infrastructure.
- Continue `game-shell.tsx` cleanup only as needed.
- Docs/browser QA before future merges.

## What Was Working Recently

These parts were recently reported by the user as working or close enough:

- Root Worksheet POV room and seated pointer-lock mode.
- Laptop focus and tabs after recent fixes.
- Music playback on laptop, with tab behavior fixed enough to push previously.
- Phone focus/reward quote flow had been iterated, but further reward infrastructure remains incomplete.
- Pen-on-desk and raised pen cursor had been made visually acceptable before the book experiment.
- Pipeline page styling was made closer to the original Quadratics logs.

Do not rework these unless the current task directly requires it.

## What Is Incomplete

- Full Lesson 1 interactive worksheet playback is not done.
- The worksheet is not yet rendering the final desired flat paper section flow.
- Incorrect-answer explanations are not complete.
- Easter egg/Rickroll reward persistence is not complete.
- Exact input/output visibility for every pipeline stage was requested, but verify current status before changing.
- Game-shell modularity improved but may still need cleanup as features touch it.

## Key Project Guides

Read these first in a new thread:

- `AGENTS.md` for project-wide constraints.
- `apps/web/AGENTS.md` for frontend conventions.
- `apps/web/components/game/AGENTS.md` if present; game-specific instructions may exist.
- `docs/todo.md` and `docs/to-do.md` for active backlog.
- `docs/architecture.md` only if broader data flow is needed.

## Cautions

- Do not commit or push unless the user explicitly asks.
- Do not delete user assets or `misc` files.
- Use focused reads; do not load all of `game-shell.tsx` unless necessary.
- Prefer editing the specific renderer/progress files for the immediate task.
- For frontend visual changes, inspect with Playwright/screenshot when practical.
- For OpenAI/third-party docs, use current docs if implementation depends on updated API behavior.

## Suggested Next Step In Fresh Thread

1. Read `AGENTS.md`, this handoff, `docs/todo.md`, and `docs/to-do.md`.
2. Check `git status --short`.
3. Inspect only:
   - `apps/web/components/game/game-worksheet-renderer.ts`
   - `apps/web/components/game/game-worksheet-props.ts`
   - `apps/api/app/services/game/progress.py`
   - `apps/web/lib/game/progress-client.ts` if needed for error messages
4. Patch progress status defaulting.
5. Replace the book/two-page/browser-style lesson rendering with the flat paper section flow.
6. Run targeted validation:

```sh
pnpm typecheck
uv run --project apps/api python -m py_compile apps/api/app/services/game/progress.py
```

If the dev server is already running, take a browser screenshot of the root game flow after the patch.
