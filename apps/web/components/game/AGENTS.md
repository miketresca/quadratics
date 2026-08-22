# Game Agent Guide

This directory owns the worksheet POV lab and 3D desktop experience. Treat `game-shell.tsx` as the orchestration boundary, not the default home for every new behavior.

Before changing game behavior, check `docs/to-do.md` from the repository root. Add newly requested game tasks there, and remove completed items in the same change that finishes them.

## Architecture

- Keep substantial scene object creation, runtime interaction, worksheet playback, laptop UI, phone, clock, map, audio, and pipeline behavior in dedicated modules.
- Read small local modules before opening `game-shell.tsx`. Start with `game-types.ts`, `game-scene-config.ts`, `game-laptop-panels.tsx`, `game-pipeline-panel.tsx`, and `game-runtime-storage.ts` depending on the task.
- Prefer data-driven scene configuration for positioned assets. Avoid hard-coding new transforms deep inside `game-shell.tsx` when a config or object module can own them.
- React state should describe UI-visible state. Three.js frame-loop state should live in refs or controllers and synchronize deliberately.
- Provider calls and persistence should stay behind `lib/api`, backend routes, or focused game client modules. Scene code should not know provider details.
- Add concise comments around non-obvious geometry, coordinate, pointer-lock, and raycasting decisions so future agents can understand intent quickly.

## Room Coordinates

- Treat the POV lab as a seated 3D box. The canonical dimensions live in `game-scene-config.ts` under `ROOM`.
- Use this coordinate language when adding or moving objects: `x` is left/right across the desk, `y` is height from floor to ceiling, and `z` moves from the seated user toward the window wall.
- Use `DESK_SURFACE_Y`, `PAPER_Y`, `DESK_RIG_Z`, and `SEATED_CAMERA_Z` instead of re-deriving desk, paper, or camera heights in feature code.
- Put new persistent object positions in config or a small object factory. Include a one-line comment if the transform is tuned for a specific POV, focus view, or raycast target.
- Keep clickable objects registered through the existing raycast/focus target system. Do not add visual-only objects that appear clickable without interaction metadata.
- When the user describes placement in natural language, translate it into this coordinate frame first, then validate the result with a browser screenshot from the seated POV and any affected focus view.

## Adding Scene Objects

1. Start with the room model: identify whether the object belongs on the desk surface, wall, window plane, floor, or in a focused overlay.
2. Use shared constants for the anchor surface, then record the object transform as `position`, `rotation`, and `scale` in a config or object factory. Avoid scattering one-off numbers in `game-shell.tsx`.
3. Name the object or group with a stable semantic name such as `desk-phone`, `wall-visitor-map`, or `raised-pen-cursor`.
4. If the object is interactive, add a matching `InteractiveTarget` entry and focus behavior through the existing raycast path. The visible object, raycast hit area, focused camera pose, and pointer/cursor behavior should be updated together.
5. If the object uses a GLB/texture/audio asset, document the asset path in the factory or config and keep loading/caching logic outside `game-shell.tsx`.
6. Verify from at least the seated POV and the closest relevant focus mode. Check scale against nearby objects, clipping through surfaces, lighting/shadow readability, and whether the cursor target matches what the user can see.

## Future Agent Context

- Before changing the game, skim this file and the smallest relevant module instead of opening all of `game-shell.tsx`.
- For placement work, read `game-scene-config.ts` plus the object factory that owns the object. Only open `game-shell.tsx` if you need orchestration, frame-loop, or focus-mode wiring.
- For laptop changes, start in `game-laptop-panels.tsx`, `game-laptop-screen.ts`, and `game-pipeline-panel.tsx`.
- For paper/pen/worksheet changes, start in `game-worksheet-props.ts`, `game-worksheet-renderer.ts`, and `game-runtime-storage.ts`.
- For phone, clock, coffee, and visitor map changes, start in their matching `game-*.ts` object modules.
- The worksheet lesson direction is three predefined built-in lessons first. Keep `Do Now`, `Vocabulary`, and `Guided Example` as reusable section templates keyed by stable semantic IDs; do not reintroduce PDF-rendered page layouts as the source of truth.
- Plan laptop changes around future `student` and `teacher` modes. Student mode should stay lesson-support focused; teacher mode should preserve the pipeline/artifact/cost/debug controls currently on the laptop.

## Browser QA

For game frontend changes, inspect the page in a real browser before finishing. Use Playwright or browser tooling where possible and verify the affected parts of:

- room start and pause overlay
- pointer lock, Space pause/resume, and Escape focus exit
- laptop, paper, phone, map, and clock focus views
- clickable tabs, forms, and controls inside focused objects
- object scale and placement from the seated player POV
- no obvious clipping, hidden UI, stale crosshair, or incorrect pen behavior

## Refactors

- Extract behavior in small, behavior-preserving steps.
- Do not combine a large scene refactor with product behavior changes unless the task explicitly requires it.
- Run `pnpm typecheck` and `pnpm lint`; add targeted tests when extracting deterministic state logic.
