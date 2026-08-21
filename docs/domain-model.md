# Domain Model

- Equation: user input that must contain one equality and variable `x`.
- Quadratic: normalized equation equivalent to `ax^2 + bx + c = 0`.
- Method: one of factoring, square-root, completing-the-square, or quadratic-formula.
- Lesson: structured explanation for one equation and method.
- Teaching step: meaningful instructional unit for narration, timing, and video segments.
- Math line: deterministic rendered transformation inside a teaching step.
- Script: LLM-assisted narration plan generated from a completed deterministic lesson.
- Script segment: narration text for one teaching step, with references to the math-line IDs it explains.
- Speech markup: provider-ready conversational text, including SSML break tags, generated from the teacher script before narration.
- Narration segment: audio, speech text, and timing metadata generated for one script segment.
- Real-world context: optional LLM-assisted Lesson tab enrichment that explains deterministic lesson and graph facts in a short Algebra 1 scenario.
- Generation artifact: versioned output of one pipeline stage with lifecycle status, input hash, upstream artifact IDs, provider metadata, cache metadata, and optional storage references.
- Animation plan: constrained semantic visual plan generated from lesson/script/narration artifacts. It names supported primitives and narration trigger phrases, but does not contain exact render timing.
- Resolved animation timeline: deterministic timestamped animation and SFX windows derived from an animation plan and ElevenLabs alignment.
- HeyGen avatar: optional paid avatar clip artifact generated from completed narration segments.
- Base video: rendered educational blackboard video artifact produced by the standard pipeline.
- Instructor: global record containing a display name, ElevenLabs voice ID, optional HeyGen avatar ID, and optional reference image data.
- Generation job: owned audit record for a generation attempt.
- Credit transaction: legacy ledger entry from the initial scaffold. It is not part of the current user-facing internal pipeline.
- Game scene: `/game`-only Three.js study-room prototype that contains desk objects, focus targets, generated canvas textures, and CSS3D media. It is not a generation artifact.
- Game focus target: an in-world object the player can center and click, such as the worksheet, laptop, clock, wall map, or phone.
- Visitor map: generated game-scene texture that combines a current visitor pin from request geolocation headers with seeded recorded-visit pins for demo effect.
- Pomodoro timer: browser-local game timer stored in localStorage for a signed-in game session and cleared on sign-out.

Exact math values are preserved as strings and LaTeX. Display strings are not the only mathematical representation. Script text may explain the deterministic math, but it is not a source of mathematical truth.

Artifacts are the pipeline source of truth. A downstream stage should load persisted upstream artifacts and write a new downstream artifact. Reruns should reuse matching completed artifacts unless the user explicitly forces regeneration.

Real-world context is an artifact, not mathematical truth. It can make the completed lesson easier to understand, but it must be generated from deterministic lesson data and can be rerun without changing video artifacts.
