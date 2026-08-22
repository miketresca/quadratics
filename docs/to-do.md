# To Do

This file is the living project backlog. Keep it current: add newly planned work here, remove items when they are genuinely complete, and keep entries short enough that an agent can pick one up without rereading an entire chat thread.

## Worksheet POV Lab

1. Replace the top-left `WORKSHEET POV LAB` helper with a compact Minecraft-style coordinate label. It should show the current scene coordinates for whatever object or surface the center cursor is pointing at.

2. Add a minimal top-right controls label. It should clearly show that `Space` pauses/resumes and `Esc` exits the current focus view.

3. Gate Lesson 1 from the desk paper until the final published pipeline artifact is complete. If the user clicks Lesson 1 too early, keep them in the scene and direct them to finish the laptop pipeline.

4. Finish the Lesson 1 interactive worksheet experience. The paper should transform into the real lesson sheet, support page/section progression, include typed answer fields, animate pen-writing behavior, and provide a clear final completion UX.

5. Improve game lesson pipeline content. Section scripts should assume textbox-based student input, use sixth-grade language, and separate section directions from answer/explanation narration.

6. Expose exact input and output for every game pipeline stage. LLM and ElevenLabs stages should make the exact submitted payload and generated result inspectable from the laptop pipeline UI.

7. Build the incorrect-answer explanation flow. The system should check student answers, identify wrong responses, generate/reuse per-question explanations, persist those artifacts, and avoid regenerating reusable explanations unnecessarily.

8. Finish the phone reward and Easter egg infrastructure. Completing Lesson 1 should trigger the vibration/Rickroll reward flow, the mug egg should show progress, and Supabase should persist account-specific Easter egg state.

9. Continue `game-shell.tsx` cleanup only as needed. Keep new game behavior modular, documented, and placed in focused modules so agents do not need to load the whole scene to make small changes.

10. Before merging future feature branches, update relevant docs, run browser QA on the root game scene, validate signed-in/provider paths, and preserve the route split: `/` is the worksheet POV lab and `/v1` is the original quadratics app.
