# To Do

This file is the living project backlog. Keep it current: add newly planned work here, remove items when they are genuinely complete, and keep entries short enough that an agent can pick one up without rereading an entire chat thread.

## Worksheet POV Lab

1. Build the three predefined lessons as first-class templates. Each built-in lesson should use the same section model (`Do Now`, `Vocabulary`, `Guided Example`) with lesson-specific content, answer keys, explanation audio, and reusable page layouts.

2. Split the laptop experience into student and teacher views. Student mode should expose study helpers, music, and lesson support. Teacher mode should expose the current pipeline/debug surface, artifact details, approval controls, costs, and behind-the-scenes generation state.

3. Finish section completion rules for Lesson 1. Do Now, Vocabulary, and Guided Example should each own independent completion state, and the lesson should only complete once every section is correct or otherwise explicitly complete.

4. Move Lesson 1 worksheet answer keys and fill target metadata back to one source of truth before enabling Vocabulary or Guided Example validation. The renderer can own visual placement, but expected answers should come from the lesson template or a shared typed lesson definition.

5. Finish the reusable incorrect-answer explanation flow. The worksheet can check typed answers and persist feedback, but the next pass should generate/reuse per-question explanation artifacts so two users with the same missed item can share the same approved explanation.

6. Replace generated Vocabulary term illustrations with managed image assets. The base Vocabulary page template is acceptable for now, but the Volume image should later render from uploaded/curated term images that can be swapped manually per vocabulary term.

7. Finish the phone reward and Easter egg infrastructure. Completing Lesson 1 should trigger the vibration/Rickroll reward flow, the mug egg should show progress, and Supabase should persist account-specific Easter egg state.

8. Continue `game-shell.tsx` cleanup only as needed. Keep new game behavior modular, documented, and placed in focused modules so agents do not need to load the whole scene to make small changes.

9. Preserve teacher pipeline behavior while student-facing lesson polish continues. The laptop pipeline should keep provider, last-run time, stale state, approval state, run/rerun buttons, loading state, stage info popovers, exact inputs/outputs, and cost visibility available in teacher mode.

10. Before merging future feature branches, update relevant docs, run browser QA on the root game scene, validate signed-in/provider paths, and preserve the route split: `/` is the worksheet POV lab and `/v1` is the original quadratics app.
