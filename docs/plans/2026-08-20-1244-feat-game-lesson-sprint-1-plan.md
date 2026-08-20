---
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: docs/plans/2026-08-20-1228-feat-game-lesson-master-plan.md
execution: code
---

# Game Lesson Sprint 1 Plan

## Implementation Status

Status: completed on `feat/game-lesson-sprint-1`.

Sprint 1 shipped the planned `/game` vertical slice: shared Quadratics header chrome, public signed-out game shell, authenticated fighter/progress persistence, one unlocked PDF-backed placeholder lesson, one locked future lesson interaction, reset behavior, redacted game logs, Supabase progress migration, local static runtime assets, and focused web/API tests.

The implementation also went beyond the original shell plan by replacing flat character cards with WebGL character model previews, adding a WebGL arena with the Final Destination-style platform and lesson orbs, supporting keyboard movement/jump/collision in the arena, preserving the game route state across refreshes, and adding a camera zoom indicator.

Review cleanup: raw source/download assets under root `assets/screens` and `assets/sprites` were removed from git tracking and ignored. Runtime assets remain under `apps/web/public/game`, with attribution in `apps/web/public/game/attribution.md`.

## Goal Capsule

| Field | Value |
| --- | --- |
| Objective | Build the first `/game` vertical slice: a fast, game-like lesson launcher with the existing Quadratics header, real sprite-style assets, one playable placeholder lesson using the worksheet PDF, locked future lesson interactions, progress persistence, and redacted game logs. |
| Means | Refactor shared app header chrome, add isolated game route/components, create a local optimized asset manifest, copy/serve the lesson PDF as a placeholder lesson surface, add a small Supabase-backed authenticated progress API, and add a read-only logs drawer from typed static summaries. |
| Authority | Sprint 1 is a UI/progress/demo shell, not the dynamic worksheet generation pipeline. No paid provider calls, no Motion Canvas worksheet render, no LLM, and no ElevenLabs should run in this sprint. |
| Stop Conditions | Stop after `/game` is usable with one unlocked lesson, one locked future lesson, progress/reset behavior, redacted logs, and tests. Defer generated lessons, videos, narration, and rerunnable game artifacts. |
| Branch | `feat/game-lesson-sprint-1`, based on updated `main` after merging the master plan. |

---

## Product Contract

### Summary

Sprint 1 should make the new game direction feel real without building the expensive dynamic content pipeline yet. The page lives at `/game`, keeps the existing Quadratics header at the top, then renders an N64/Super Smash-inspired game surface below it.

The first lesson is unlocked and opens the worksheet PDF as-is. The second/future lesson is locked but interactive: it should react, explain that the dynamic lesson pipeline is coming later, and avoid doing any paid or generated work. The user should be able to select a fighter, enter the arena, open the unlocked lesson, mark progress by viewing the PDF/lesson surface, reset progress, and inspect a redacted log drawer that tells the production story without exposing raw payloads or private data.

### Key Decisions

- KD1. **Branch from updated `main`** (user-directed - the master plan was merged to `main` first, then Sprint 1 branches from it). Governs U0.
- KD2. **Keep existing top header on `/game`** (user-directed - the Quadratics logo, build chip, GitHub, and account controls stay visible). Governs R1, U1.
- KD3. **One unlocked placeholder lesson in Sprint 1** (user-directed - use the PDF lesson as-is; do not build the pre-rendered video pipeline yet). Governs R11, U4.
- KD4. **Locked future lesson remains interactive** (user-directed - show the future dynamic lesson path without building it yet). Governs R12, R13.
- KD5. **Use actual sprite-style assets locally and optimize for speed** (user-directed plus technical judgment - local static assets give faster first-load/cache behavior than fetching from Supabase for shell UI). Governs R17, R18, U2.
- KD6. **No paid generation in Sprint 1** (technical judgment - this sprint proves the product shell and interaction model only). Governs R24, R25.
- KD7. **Redacted logs only** (master-plan decision - raw JSON and private storage refs are not part of public Sprint 1 logs). Governs R31, R33, R35, R36.
- KD8. **Arena is actually playable in Sprint 1** (user-directed - the selected fighter should walk on the platform and jump into lesson orbs). Governs R10a, R10b, R10c, R43, U4.

### Requirements

**Route and Header**

- R1. Add `/game` as a first-class Next.js App Router page.
- R2. `/game` must render below the same top Quadratics header/auth shell used by the root page.
- R3. Header code should be extracted into shared components instead of copy-pasting divergent header implementations.
- R4. The existing root `/` page must keep the same behavior and visual layout after header extraction.
- R5. `/game` must not import `EquationForm`, `LessonResult`, or other quadratic workflow components for core game rendering.

**Game Flow**

- R6. Signed-out visitors can view the game shell and asset-rich character select.
- R7. Signed-out visitors who click/select a fighter see a compact login-required prompt and do not mutate progress.
- R8. Signed-in users can select one fighter, see the one-player slot populate, and start with Space/Enter or click/tap.
- R9. The selected fighter persists for the signed-in user.
- R10. The arena screen shows the selected fighter plus lesson balls/cards.
- R10a. In the arena, the selected fighter can move left/right on the platform with `ArrowLeft`/`ArrowRight` and `A`/`D`.
- R10b. In the arena, the selected fighter can jump with `Space`, `ArrowUp`, or `W`; jump should work only from the platform/ground state.
- R10c. Lesson orbs activate through simple 2D collision: hitting the unlocked orb opens Lesson 1, and hitting the locked orb shows the locked coming-soon message.
- R11. Lesson 1 is unlocked and opens the worksheet PDF placeholder.
- R12. Lesson 2 is locked but interactive: hover/focus/click should show a coming-soon message about future generated lessons.
- R13. Locked lesson interaction must not call generation APIs, providers, or storage mutation endpoints.
- R14. Users can return from the lesson view to the arena.
- R15. Users can reset game progress from an authenticated control.
- R16. Progress save failures must show a clear error and must not falsely mark a lesson completed or unlocked.

**Assets and Performance**

- R17. Sprint 1 uses real sprite-style assets from the supplied Smash/Spriters sources for the prototype, with explicit manifest source attribution and replaceability metadata.
- R18. Runtime assets should be local static files under the web app, not Supabase Storage, for the game shell: they are small, cacheable, and should be deployed with the frontend.
- R19. Supabase Storage is deferred for generated/published videos and large future media, not sprite UI.
- R20. Assets must be normalized through a manifest, not hardcoded throughout components.
- R21. The first viewport should load without pulling every arena/lesson asset. Use posters, sprite sheets, lazy loading, and route-local dynamic imports where appropriate.
- R22. Do not commit raw downloaded ZIP archives. Commit only the optimized assets required by Sprint 1 plus an attribution/source note.
- R23. If an asset source is not legally safe for production, mark it `prototype_reference` in the manifest.

**No Generation**

- R24. Sprint 1 must not call OpenAI, ElevenLabs, HeyGen, Motion Canvas render, or any paid provider.
- R25. Sprint 1 must not add run/rerun buttons for game generation stages.
- R26. Sprint 1 logs are static/read-only published snapshots that describe the planned pipeline, not live rerunnable artifacts.

**Lesson Placeholder**

- R27. The unlocked lesson uses the PDF from `misc/task/task_lesson.pdf` as the placeholder lesson content.
- R28. The app should serve a copied public/static version or an API-served version of the PDF, not reference the `misc/` path directly from the browser.
- R29. The lesson placeholder should be lazy-loaded only after the user opens the lesson.
- R30. PDF loading, PDF error, and fallback "open PDF" states must exist.
- R30a. Before publishing the copied PDF, inspect it for hidden/private metadata or unintended content. Document it as intentionally public demo content, and serve it with a known-safe browser content type and cache posture.

**Logs and Debug Surface**

- R31. `/game` has a logs drawer hidden behind a small game-HUD control.
- R32. Desktop logs open as a right-side drawer; mobile logs open as a full-screen sheet.
- R33. Logs show redacted stage summaries for the current lesson using the concrete Sprint 1 stages: `game_route`, `asset_manifest`, `lesson_catalog`, `progress_state`, `pdf_placeholder`, and `future_pipeline_locked`.
- R34. Logs should explain that Sprint 1 is using a PDF placeholder and that rendered worksheet videos are planned for a later sprint.
- R35. Public/signed-out logs show only redacted summaries. Signed-in users still do not see raw provider payloads because Sprint 1 has none.
- R36. Opening logs must not cover controls in a way that traps the user; focus moves into the drawer and returns to the trigger on close.

**Progress and Data**

- R37. Add normalized game progress persistence:
  - selected fighter per user
  - per-lesson progress rows keyed by `(user_id, lesson_id)`
  - user-specific status values `started` and `completed`
  - timestamps for started/completed where relevant
- R38. Progress APIs must require authentication and must only read/write `current_user.id`.
- R39. Public lesson metadata should remain web-local static data in Sprint 1; do not add a public lesson API until lesson definitions are database-backed or artifact-backed.
- R40. Missing auth must not block the public `/game` shell, but it must block user-specific progress reads/mutations.
- R41. RLS policies must protect user-owned progress rows.
- R42. Reset progress deletes or resets only the authenticated user's game progress rows.
- R42a. Progress mutations must validate `lesson_id` against the server-side static Sprint 1 catalog, reject unknown lessons, reject locked/future lesson start or completion, validate `selected_fighter_id` against the fighter manifest, and ignore client-supplied `user_id`, status, and timestamps.

**Accessibility and States**

- R43. Fighter select uses keyboard-accessible roving focus or equivalent predictable tab/focus behavior.
- R44. Lesson balls/cards are focusable and have clear labels for unlocked/locked states.
- R45. Custom hand cursor visuals must not replace real focus indicators.
- R46. Touch targets must be at least 44px in practical hit area.
- R47. Reduced-motion users should get simpler transitions without losing navigation.
- R48. UI states must cover auth loading, signed out, no progress, metadata empty, manifest error, PDF loading, PDF error, completed, save failed, reset confirm, and reset cancel.

### Acceptance Examples

- AE1. Given a signed-out visitor opens `/game`, the existing Quadratics header appears, the game shell loads, and no paid provider request is made.
- AE2. Given a signed-out visitor selects a fighter, a login-required prompt appears and no progress API mutation runs.
- AE3. Given a signed-in user selects a fighter and presses Space, the selected fighter appears in the player slot and the arena opens.
- AE4. Given a signed-in user reloads `/game`, the previously selected fighter is restored.
- AE5. Given a signed-in user opens Lesson 1, the PDF placeholder loads lazily and shows fallback controls if embedding fails.
- AE6. Given a signed-in user opens Lesson 1, progress moves to `started`; when they mark/complete the placeholder lesson, progress moves to `completed`.
- AE7. Given progress save fails, the UI shows an error and does not mark the lesson completed.
- AE8. Given a user interacts with Lesson 2, it reacts visually and explains that dynamic generated lessons are locked for a future sprint.
- AE9. Given a user opens logs, a redacted logs drawer/sheet appears with stage summaries and no raw secrets, signed URLs, or provider payloads.
- AE10. Given the root `/` app is opened after Sprint 1, the Quadratics equation flow still works and the header looks unchanged.

---

## Technical Design

### Route Structure

```text
apps/web/app/page.tsx
apps/web/app/game/page.tsx
apps/web/components/app-header.tsx
apps/web/components/game/
  game-shell.tsx
  character-select.tsx
  player-slot.tsx
  game-arena.tsx
  lesson-ball.tsx
  game-lesson-panel.tsx
  game-logs-drawer.tsx
  game-login-prompt.tsx
apps/web/lib/game/
  assets.ts
  lessons.ts
  progress-client.ts
  state.ts
apps/web/public/game/
  assets/
  lessons/
  attribution.md
packages/types/src/game.ts
```

`app-header.tsx` should own the reusable header/chrome that currently lives inside `apps/web/app/page.tsx`. Keep behavior stable by moving, not redesigning, the existing logo/build/account pieces. If any header helper currently depends on server-only values such as build info, keep a server wrapper that passes serializable props to client-safe header pieces.

### API Structure

```text
apps/api/app/main.py
apps/api/app/api/routes/game_progress.py
apps/api/app/services/game/
  catalog.py
  progress.py
infra/supabase/migrations/
  YYYYMMDDHHMMSS_game_progress.sql
```

Sprint 1 should keep APIs small:

```text
GET  /api/v1/game/me/progress
PUT  /api/v1/game/me/progress
POST /api/v1/game/me/progress/reset
```

No public lesson API and no `POST /stages/...` endpoint in Sprint 1. The lesson catalog is static web-local data; the API only persists authenticated user progress.

### Data Model

Add migration for:

```sql
create table public.game_user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  selected_fighter_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table public.game_user_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null,
  status text not null check (status in ('started', 'completed')),
  started_at timestamptz,
  completed_at timestamptz,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);
```

RLS:

- users can select/insert/update/delete only their own `game_user_progress`
- users can select/insert/update/delete only their own `game_user_lesson_progress`
- locked/unlocked lesson availability is derived from the static lesson catalog, not stored as per-user progress in Sprint 1

### Static Lesson Metadata

Use static public lesson definitions in `apps/web/lib/game/lessons.ts` until a database-backed lesson catalog is needed. The API keeps only a minimal private validation allowlist for lesson IDs, lock state, and fighter IDs so progress mutations cannot trust client-provided values.

Example shape:

```ts
type GameLesson = {
  id: "volume-cubes-lesson-1" | "dynamic-lesson-locked";
  slug: string;
  title: string;
  status: "unlocked" | "locked";
  kind: "pdf_placeholder" | "future_dynamic";
  pdfUrl?: string;
  posterUrl?: string;
  logSummary: PublicGameLogStageSummary[];
};
```

The unlocked lesson should copy `misc/task/task_lesson.pdf` into a browser-served location such as `apps/web/public/game/lessons/volume-cubes/task-lesson.pdf` during implementation. Do not serve directly from `misc/`. Before copying, inspect the PDF metadata/content and document in `apps/web/public/game/lessons/volume-cubes/README.md` that it is intentionally public demo content.

### Asset Strategy

For Sprint 1, use local optimized static assets:

- source candidate references:
  - Super Smash Bros. N64 sprite/menu assets on The Spriters Resource
  - Character select/menu assets from the N64 page
  - 2D hand/cursor, lesson ball, fighter, menu, and arena references only
  - model/audio references stay deferred; do not normalize 3D model archives or add audio in Sprint 1
- local output:
  - `apps/web/public/game/assets/sprites/...`
  - `apps/web/public/game/assets/ui/...`
  - `apps/web/public/game/assets/backgrounds/...`
- manifest:
  - `id`
  - `displayName`
  - `role`
  - `src`
  - `width`
  - `height`
  - `sourceUrl`
  - `legalStatus: "prototype_reference" | "original" | "licensed"`
  - `preload: boolean`

Optimization rules:

- commit only the cropped/optimized image files needed by Sprint 1
- prefer PNG for pixel art with transparency
- group small related sprites into sprite sheets when practical
- preload only the character-select essentials
- lazy-load arena/background/PDF assets after start
- do not store small shell sprites in Supabase; that adds network/auth complexity without benefit

### UI State Machine

```text
boot
  -> loading_static_catalog
  -> character_select
      -> signed_out_prompt
      -> fighter_selected
      -> start_requested
  -> arena
      -> unlocked_lesson_focus
      -> locked_lesson_focus
      -> locked_lesson_message
  -> lesson_panel
      -> pdf_loading
      -> pdf_ready
      -> pdf_error
      -> progress_saving
      -> progress_saved
      -> progress_failed
  -> logs_drawer
  -> reset_confirm
```

The state machine can live as plain React state; do not add a state-machine library.

### Logs Drawer

Stages for Sprint 1:

```text
game_route
asset_manifest
lesson_catalog
progress_state
pdf_placeholder
future_pipeline_locked
```

The drawer should communicate:

- what loaded
- what is static vs future generated
- why the PDF is a placeholder
- what data would become artifacts in later sprints
- current user progress status if signed in

No raw JSON expansion in Sprint 1. Define and render a `PublicGameLogStageSummary` allowlist type with only safe fields such as `id`, `label`, `status`, `summary`, `inputs`, `outputs`, and `futureWork`. Do not render provider payloads, signed URLs, storage refs, bearer values, user identifiers, or arbitrary nested objects.

### Interaction Contracts

**Lesson completion:** Sprint 1 uses an explicit `Complete Lesson` button shown after the PDF panel opens. The button has enabled, saving, saved, and failed states. It does not auto-complete based on scroll position or elapsed time.

**Reset:** The authenticated reset control lives in the game HUD/account-adjacent controls. Activating it opens a compact confirm dialog or sheet with `Cancel` and `Reset progress`. Cancel closes without mutation and returns focus to the trigger. Reset enters a saving state, shows success or error, and returns the user to the initial character-select state if successful.

**Keyboard:** Fighter select and lesson balls use the same keyboard contract: Tab enters/exits the interactive region, arrow keys move between available items, Enter/Space activates the focused item, Escape dismisses prompts/drawers, selected items expose `aria-selected`, and locked lesson balls expose an accessible locked label plus a coming-soon description.

**Arena movement:** Once the arena is active, keyboard input switches to lightweight platform controls: `A`/`ArrowLeft` moves left, `D`/`ArrowRight` moves right, and `W`/`ArrowUp`/`Space` jumps. Movement is bounded to the platform, uses minimal gravity/velocity state, respects reduced-motion by reducing flourish rather than disabling control, and exposes non-keyboard fallback actions for touch users.

### State Coverage Table

| State | Component Surface | User-Facing Behavior | Required Test |
| --- | --- | --- | --- |
| auth loading | `GameShell` | show shell skeleton without allowing progress mutation | signed-out fallback does not flash mutation UI |
| signed out | `CharacterSelect` | view game shell, prompt login on fighter action | fighter click opens login prompt only |
| no progress | `GameShell` | default empty one-player slot | signed-in new user starts clean |
| metadata empty | `GameShell` | show unavailable lesson/catalog state | empty catalog fixture renders fallback |
| manifest error | `GameShell` | show asset fallback without crashing | missing asset fixture renders fallback |
| PDF loading | `GameLessonPanel` | show loading state after lesson opens | lazy PDF render starts loading |
| PDF error | `GameLessonPanel` | show fallback open/download PDF action | embed error exposes fallback |
| completed | `GameLessonPanel` / `Arena` | mark Lesson 1 completed and update progress display | complete button persists status |
| save failed | progress UI | show error and keep previous persisted state | failed mutation does not mark complete |
| reset confirm | reset dialog/sheet | show cancel/reset actions | confirm opens with focus |
| reset cancel | reset dialog/sheet | close without mutation and return focus | cancel does not call reset endpoint |

---

## Implementation Units

### U0: Branch and Baseline

**Goal:** Keep branch history clean.

**Steps**

- Ensure `main` includes `docs/plans/2026-08-20-1228-feat-game-lesson-master-plan.md`.
- Ensure `feat/game-lesson-sprint-1` tracks `origin/feat/game-lesson-sprint-1`.
- Do not include existing unrelated `misc/` file moves/deletions unless the implementation explicitly needs the task PDF copied into `apps/web/public/game/lessons/...`.

**Verification**

- `git status --short --branch`
- branch shows `feat/game-lesson-sprint-1...origin/feat/game-lesson-sprint-1`

### U1: Shared Header Extraction

**Goal:** Reuse the current top header on `/` and `/game` without changing existing behavior.

**Likely Files**

- `apps/web/app/page.tsx`
- `apps/web/app/game/page.tsx`
- `apps/web/components/app-header.tsx`
- `apps/web/tests/...`

**Approach**

- Move reusable header logic/components from `app/page.tsx` into `components/app-header.tsx`.
- Keep server-only build info lookup server-side.
- Keep account menu behavior unchanged.
- Use the shared header in root page and game page.

**Tests**

- Existing root render/component tests still pass.
- Add or update test confirming header can render with signed-in and signed-out props.

### U2: Asset Manifest and Local Static Assets

**Goal:** Establish fast, replaceable, source-attributed assets for Sprint 1.

**Likely Files**

- `apps/web/lib/game/assets.ts`
- `apps/web/public/game/assets/...`
- `apps/web/public/game/attribution.md`

**Approach**

- Use actual sprite/menu assets from the supplied/reference sources for prototype.
- Crop/optimize only the pieces needed for character select, selected fighter, hand cursor, lesson balls, and arena background.
- Store locally under `apps/web/public/game/assets`.
- Create a typed manifest in `lib/game/assets.ts`.
- Include source URLs and `prototype_reference` status.

**Tests**

- Unit test that every manifest `src` points to an existing public file.
- Unit test that required asset IDs exist.

### U3: Public Game Route and Character Select

**Goal:** Add the first playable game shell below the shared header.

**Likely Files**

- `apps/web/app/game/page.tsx`
- `apps/web/components/game/game-shell.tsx`
- `apps/web/components/game/character-select.tsx`
- `apps/web/components/game/player-slot.tsx`
- `apps/web/components/game/game-login-prompt.tsx`
- `apps/web/lib/game/state.ts`
- `apps/web/tests/game-shell.test.tsx`

**Approach**

- Server page loads session/user using existing auth helpers.
- Client shell receives `initialUser`.
- Signed-out fighter select opens prompt.
- Signed-in fighter select populates player slot.
- Space/Enter or start click transitions to arena.
- Custom cursor/hand visual is decoration only; real focus remains visible.

**Tests**

- Signed-out selection prompts login.
- Signed-in selection populates slot.
- Keyboard start works after selection.
- Reduced-motion mode does not block navigation.

### U4: Lesson Catalog, PDF Placeholder, and Arena

**Goal:** Provide one unlocked PDF lesson, one locked future lesson, and a playable arena where the selected fighter jumps into lesson orbs.

**Likely Files**

- `apps/web/lib/game/lessons.ts`
- `apps/web/components/game/game-arena.tsx`
- `apps/web/components/game/lesson-ball.tsx`
- `apps/web/components/game/game-lesson-panel.tsx`
- `apps/web/public/game/lessons/volume-cubes/task-lesson.pdf`
- `apps/web/public/game/lessons/volume-cubes/README.md`
- `apps/web/tests/game-lessons.test.tsx`

**Approach**

- Inspect the task lesson PDF for hidden/private metadata or unintended content, then copy it into a public game lesson folder.
- Add a short README beside the copied PDF stating it is intentionally public demo content and where it came from.
- Define `volume-cubes-lesson-1` as unlocked with `kind: "pdf_placeholder"`.
- Define `dynamic-lesson-locked` as locked with `kind: "future_dynamic"`.
- Arena shows both as interactive lesson balls/cards.
- Add lightweight platform movement with bounded left/right position, jump velocity, gravity, and ground collision.
- Map movement to `ArrowLeft`/`ArrowRight`/`A`/`D`, jump to `Space`/`ArrowUp`/`W`, and keep controls active only while the arena has focus or is the current game mode.
- Add orb hitboxes. Collision with `volume-cubes-lesson-1` opens the PDF lesson panel and starts progress; collision with `dynamic-lesson-locked` opens the locked message and performs no mutation.
- Add touch/non-keyboard fallback controls so the lesson can still be opened without physical keyboard movement.
- Lesson 1 opens a PDF embed/object with loading, fallback link, and error state.
- Lesson 2 shows a locked message and does nothing else.

**Tests**

- Unlocked lesson opens PDF panel.
- Moving into the unlocked orb opens the PDF panel.
- Jumping into the locked orb shows the locked message.
- Movement stays inside platform bounds.
- Jump cannot stack infinitely while airborne.
- PDF fallback link exists.
- Locked lesson shows coming-soon message.
- Locked lesson does not call any progress mutation.

### U5: Progress API, RLS, and Client Wiring

**Goal:** Persist selected fighter and lesson progress for signed-in users.

**Likely Files**

- `infra/supabase/migrations/..._game_progress.sql`
- `packages/types/src/game.ts`
- `packages/types/src/index.ts`
- `apps/api/app/main.py`
- `apps/api/app/api/routes/game_progress.py`
- `apps/api/app/services/game/catalog.py`
- `apps/api/app/services/game/progress.py`
- `apps/web/lib/game/progress-client.ts`
- `apps/web/components/game/...`
- `apps/api/tests/...`

**Approach**

- Add `game_user_progress` and `game_user_lesson_progress` tables.
- Add RLS policies for own-user access.
- Add only authenticated progress routes under `/api/v1/game`.
- Register the progress router in `apps/api/app/main.py`; route files are not served until they are explicitly included by the FastAPI app.
- Progress routes require `get_current_user`.
- Use a compact mutation surface: `GET /api/v1/game/me/progress`, `PUT /api/v1/game/me/progress`, and `POST /api/v1/game/me/progress/reset`.
- `PUT /api/v1/game/me/progress` accepts an explicit action enum such as `select_fighter`, `start_lesson`, or `complete_lesson`.
- The progress service validates `selected_fighter_id` against the fighter manifest/allowlist and `lesson_id` against the server-side Sprint 1 catalog.
- The progress service rejects unknown lessons, locked/future lesson start/completion, invalid transitions, and all client-supplied user/status/timestamp authority.
- Client saves selected fighter, started, completed, and reset through this progress API.
- Completion for Sprint 1 is an explicit `Complete Lesson` button after opening the PDF. Do not auto-complete based on scroll, focus, or elapsed time.

**Tests**

- API rejects progress mutation without bearer token.
- API prevents cross-user progress access.
- API rejects invalid fighter IDs.
- API rejects unknown lesson IDs.
- API rejects locked/future lesson start and completion.
- Selected fighter persists.
- Lesson completion persists.
- Reset clears only current user's progress.

### U6: Redacted Logs Drawer

**Goal:** Add inspectable game logs without exposing raw artifacts or building live stages.

**Likely Files**

- `apps/web/components/game/game-logs-drawer.tsx`
- `apps/web/lib/game/lessons.ts`
- `apps/web/tests/game-logs.test.tsx`

**Approach**

- Add a HUD logs button.
- Desktop drawer from right; mobile full-screen sheet.
- Focus moves into drawer and returns on close.
- Show stage summaries from static lesson metadata.
- Include a stage explaining Sprint 1 PDF placeholder.
- Include a stage explaining future generated worksheet/video pipeline is locked.
- Render logs from the `PublicGameLogStageSummary` allowlist type only.

**Tests**

- Drawer opens/closes.
- Focus return works.
- Logs do not include blocked fields such as `signedUrl`, `apiKey`, `bearer`, storage refs, user IDs, or raw provider payload markers.
- Fixture tests prove arbitrary raw payload/storage/ref/provider request objects cannot be rendered or returned by the public logs path.

### U7: Polish, Performance, and Regression

**Goal:** Keep the route fast and the existing app stable.

**Likely Files**

- `apps/web/app/globals.css`
- game component files
- test files

**Approach**

- Lazy-load PDF panel and arena-heavy assets.
- Preload only character select essentials.
- Keep layout responsive.
- Use accessible labels and focus states.
- Avoid a global CSS palette that affects current app unintentionally.

**Verification**

- `pnpm --filter @quadratics/web lint`
- `pnpm --filter @quadratics/web test`
- `pnpm typecheck`
- manual browser check for `/` and `/game`

---

## Verification Contract

### Required Checks

```sh
pnpm --filter @quadratics/web lint
pnpm --filter @quadratics/web test
pnpm typecheck
uv run --project apps/api pytest
```

If only web/static work is touched before API progress is added, the API test can wait until U5. Before merging Sprint 1, run all checks above.

### Manual QA

- `/` signed out still renders the current app shell and header.
- `/` signed in still renders cost chip/account menu/equation workflow.
- `/game` signed out shows header, character select, and login prompt on fighter click.
- `/game` signed in selects fighter, starts arena, opens Lesson 1 PDF, completes lesson, resets progress.
- `/game` locked lesson reacts and never starts generation.
- `/game` logs drawer opens/closes on desktop and mobile widths.
- Browser network tab shows no OpenAI, ElevenLabs, HeyGen, or Motion Canvas render calls.
- Lighthouse/basic network check confirms assets are not all eagerly downloaded before start.

### Asset QA

- All manifest assets resolve with 200.
- No raw ZIP archives committed.
- Public asset directory size is reasonable for a first interactive page.
- Source attribution file names every external/prototype asset source.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Real Smash assets create legal/production risk | Could require redesign before public launch. | Mark as `prototype_reference`, isolate through manifest, and keep replacement path simple. |
| Asset files make `/game` slow | First impression suffers. | Local optimized assets, sprite sheets, preload only essentials, lazy-load PDF/arena. |
| Header extraction regresses root app | Current working product breaks. | Move behavior carefully, add root regression tests, visually check `/`. |
| PDF embed is inconsistent across browsers | Placeholder lesson may fail to display. | Provide fallback link/open button and clear error state. |
| Progress API adds migration risk | Main app auth/data could be affected. | New isolated tables/routes, RLS own-user policies, no changes to existing generation tables. |
| Logs confuse student flow | Debug surface distracts from game. | Hide behind a small internal/debug drawer trigger; keep default path focused. |

---

## Deferred From Sprint 1

- Motion Canvas worksheet render.
- Prebuilt rendered lesson videos.
- ElevenLabs narration.
- LLM-generated lesson scripts.
- Dynamic worksheet generation.
- Rerunnable game artifact stages.
- Supabase Storage for generated game videos.
- Per-glyph handwriting manifests.
- Full random/unlocked lesson pipeline.

---

## References

- Master plan: `docs/plans/2026-08-20-1228-feat-game-lesson-master-plan.md`
- Web guide: `apps/web/AGENTS.md`
- API guide: `apps/api/AGENTS.md`
- Auth docs: `docs/auth-and-usage.md`
- Architecture docs: `docs/architecture.md`
- Local task lesson source: `misc/task/task_lesson.pdf`
- Super Smash Bros. N64 sprites/menus: https://www.spriters-resource.com/nintendo_64/ssb/page-1/
- Super Smash Bros. custom sprites: https://www.spriters-resource.com/custom_edited/supersmashbroscustoms/
- Master Hand model reference: https://models.spriters-resource.com/nintendo_64/ssb/asset/283437/
- Smash Ball model reference: https://models.spriters-resource.com/wii/ssbb/asset/292971/
- Super Smash Bros. N64 sounds reference: https://sounds.spriters-resource.com/nintendo_64/ssb/asset/396114/
