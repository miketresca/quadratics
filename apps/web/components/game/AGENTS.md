# Game Agent Guide

This directory owns the worksheet POV lab and 3D desktop experience. Treat `game-shell.tsx` as the orchestration boundary, not the default home for every new behavior.

## Architecture

- Keep substantial scene object creation, runtime interaction, worksheet playback, laptop UI, phone, clock, map, audio, and pipeline behavior in dedicated modules.
- Prefer data-driven scene configuration for positioned assets. Avoid hard-coding new transforms deep inside `game-shell.tsx` when a config or object module can own them.
- React state should describe UI-visible state. Three.js frame-loop state should live in refs or controllers and synchronize deliberately.
- Provider calls and persistence should stay behind `lib/api`, backend routes, or focused game client modules. Scene code should not know provider details.
- Add concise comments around non-obvious geometry, coordinate, pointer-lock, and raycasting decisions so future agents can understand intent quickly.

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
