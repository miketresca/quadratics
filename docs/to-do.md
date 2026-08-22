# To Do

This file is the living project backlog. Keep it current: add newly planned work here, remove items when they are genuinely complete, and keep entries short enough that an agent can pick one up without rereading an entire chat thread.

## Worksheet POV Lab

1. Finish the reusable incorrect-answer explanation flow. The current worksheet can check typed answers and persist feedback, but the next pass should generate/reuse per-question explanation artifacts so two users with the same missed item can share the same approved explanation.

2. Polish the Lesson 1 interactive worksheet experience. Preserve the typed answer fields and section/page progression, then tighten worksheet fidelity against the source PDF, improve pen-writing playback, and make the final completion UX feel intentional.

3. Finish the phone reward and Easter egg infrastructure. Completing Lesson 1 should trigger the vibration/Rickroll reward flow, the mug egg should show progress, and Supabase should persist account-specific Easter egg state.

4. Continue `game-shell.tsx` cleanup only as needed. Keep new game behavior modular, documented, and placed in focused modules so agents do not need to load the whole scene to make small changes.

5. Before merging future feature branches, update relevant docs, run browser QA on the root game scene, validate signed-in/provider paths, and preserve the route split: `/` is the worksheet POV lab and `/v1` is the original quadratics app.
