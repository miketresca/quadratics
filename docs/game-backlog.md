# Game Backlog

This note preserves deferred game work while the current branch focuses on `GameShell` cleanup.

## Lesson Pipeline

- Finish section-by-section worksheet transformation and playback for Lesson 1.
- Make Lesson 1 unavailable from the paper until the final publish/bundle stage is complete.
- Keep the vocabulary section read-only; it should explain terms without asking for typed user input.
- Tune section-script and speech-markup prompts for sixth-grade language and fixed worksheet input boxes.
- Show exact input and output for every pipeline stage, including LLM and ElevenLabs requests.
- Preserve original pipeline-card behavior inside the laptop: provider, last-run time, stale state, approval state, run/rerun buttons, loading state, and stage info popovers.

## Lesson Completion

- Add final completion UX after the interactive lesson ends.
- Persist user lesson progress separately from pipeline artifact reset.
- Trigger the phone reward flow after Lesson 1 completion.
- Track Easter egg progress globally enough that adding future Easter eggs only changes configuration.

## Game HUD And Routing

- Replace the top-left helper panel with a Minecraft-style coordinate label for the currently pointed scene object.
- Add a minimal top-right controls box for Space = pause and Escape = back.
- Keep the worksheet POV lab mounted at `/` and the original quadratics app mounted at `/v1`; do not reintroduce `/game` or `/app` page routes.

## Quality And Architecture

- Continue shrinking `game-shell.tsx` until it is only the Three.js/runtime orchestrator.
- Keep new scene objects data-driven with documented coordinates, rotations, scale, focus behavior, and asset paths.
- Add browser QA coverage for signed-in laptop, pipeline scrolling, paper focus, phone focus, map focus, clock focus, music persistence, and pointer-lock transitions.
