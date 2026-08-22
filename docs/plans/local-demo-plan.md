# Quadratics Demo Plan

Local working cue sheet based on `demo_yap.m4a`. Target length: about 5 minutes.

## North Star

- Show the finished video first, then explain how the system produced it.
- Position Quadratics as an inspectable video-generation pipeline, not just a solver.
- Keep repeating the core design principle: deterministic math first, AI second.
- Make the scope decision feel intentional: clean factoring first because narrow scope makes the demo reliable, high-quality, and cost-controlled.
- Show enough live generation to prove it is real, but do not let the demo become waiting around for providers.

## 0:00-0:30 - Hook

Show:
- Open `quadratics.xyz`.
- Start from a completed golden-case Lesson view if available.

Hit these points:
- Turns a quadratic homework problem into a short narrated walkthrough video.
- The differentiator is the production pipeline: visible, rerunnable, cost-aware AI/media steps.
- Demo scope is intentionally Algebra 1 quadratic factoring.
- Mention the `xyz` name only if it feels natural; do not linger on it.

Avoid:
- Starting with setup details.
- Explaining every provider before showing the output.

## 0:30-1:15 - Final Output First

Show:
- Video Solution.
- IRL Example block.
- Header spend component.

Hit these points:
- Final artifact is a generated blackboard-style lesson video.
- Motion Canvas handles deterministic board animation and timing.
- Generated narration is synced to visual steps.
- HeyGen avatar is optional; proves avatar integration but is not required for base video.
- IRL Example gives the student graph/context support after watching the video.

Important framing:
- Current visuals are a deliberate tradeoff for cheap, controllable iteration.
- Better chalk realism and higher-end video models are future enhancements, not core blockers.

## 1:15-2:30 - Work Backwards Through Logs

Show:
- Switch to Logs.
- Walk down the artifact boxes.
- Expand only a couple of logs; do not inspect every detail.

Hit these points:
- App behaves like a build system.
- Each stage persists an artifact.
- Rerun one stage instead of rebuilding everything.
- Expensive/provider-heavy stages are isolated.
- Failed/stale stages stay inspectable.

Stage reminders:
- `answer`: SymPy-backed deterministic math; normalized equation, coefficients, roots, supported method.
- `real_world_context`: optional Lesson enrichment; does not block video generation.
- `teacher_script`: LLM narration from deterministic lesson steps.
- `elevenlabs_request`: exact speech markup before audio credits are spent.
- `elevenlabs_audio`: narration segments plus alignment data.
- `heygen_avatar`: optional paid branch from completed narration.
- `animation_plan`: semantic visual plan constrained to known primitives.
- `resolved_timeline`: deterministic timing from ElevenLabs alignment.
- `motion_canvas_render`: final video render boundary.

Do not forget:
- Deterministic math owns the truth.
- AI explains, narrates, or plans around that truth.

## 2:30-3:20 - Cost And Tradeoffs

Show:
- Hover the cost component.
- Point out total spend, average without avatar, average with avatar, recent calls.

Hit these points:
- Spend visibility matters because provider calls are real money.
- OpenAI calls are usually small compared with media generation.
- ElevenLabs and HeyGen are the meaningful cost drivers.
- HeyGen adds personalization but changes the economics quickly.
- Motion Canvas avoids paying a full video model for every board animation.
- Architecture is moving toward provider/model independence.

Provider reminders:
- Veo, Kling, or Seedance could make more realistic video, but cost and iteration speed are worse.
- HeyGen is replaceable; it is not the architecture.
- ElevenLabs audio can be reused/cached by artifact and segment.
- User/provider keys make the system more flexible long-term.

## 3:20-4:35 - Fresh Generation

Show:
- Enter a non-golden clean factoring equation.
- Suggested equations:
  - `2x^2 - 7x + 3`
  - `x^2 - x - 6`
  - `3x^2 + 2x - 1`
- Run enough stages to show the pipeline is live.

Hit these points:
- Proves the app is not only replaying the golden fixture.
- Text box/backend validate the equation before generation.
- Valid quadratics outside clean factoring are handled honestly as unsupported for this demo.
- Clean rational factoring is v0 because each solving method needs its own:
  - deterministic step templates
  - prompt constraints
  - animation plan rules
  - QA/tests

Live-run strategy:
- If time is tight, run through `answer`, `real_world_context`, `teacher_script`, and `elevenlabs_request`.
- If credits/time are okay, run `elevenlabs_audio`.
- Only run HeyGen if the estimate looks reasonable and you are okay spending it.
- If HeyGen is not run live, show an existing completed HeyGen artifact.

## 4:35-5:00 - Close

Hit these points:
- Main engineering choice: modular artifact-backed pipeline.
- Main AI-content choice: narrow domain, strong guardrails, deterministic math source of truth.
- Main product tradeoff: cheap deterministic animation now, richer video-provider options later.
- Future solving methods:
  - square-root method
  - completing the square
  - quadratic formula
- Future polish:
  - better chalk realism
  - stronger avatar composition
  - more providers
  - reusable narration/media libraries

End on:
- The app shows AI content generation with deterministic math, visible costs, provider isolation, and rerunnable production steps.

## Critical Reminders

- Do not spend too long on one log box.
- Do not read a script word-for-word.
- Keep bringing it back to pipeline design and cost control.
- Mention artifact reuse as both reliability and cost savings.
- Mention unsupported valid equations as a scope decision, not a parser failure.
- Mention future support is additive because the architecture is already stage-based.
- Keep the order tight: output, pipeline, cost, fresh run, close.

## If Something Fails

- Provider call fails:
  - Show the failed artifact.
  - Explain isolated reruns.
- HeyGen is slow or expensive:
  - Skip live generation.
  - Show a previous avatar artifact.
- Fresh equation is unsupported:
  - Explain clean factoring scope.
  - Use it as a product-boundary example.
- Render takes too long:
  - Show the golden video.
  - Explain render as a separate artifact boundary.
- Costs look weird:
  - Mention cost tracking was added mid-build but now captures provider usage for debugging and average estimates.

## Backup Flow

1. Show golden video.
2. Show IRL Example.
3. Show Logs and explain the artifact pipeline.
4. Hover cost component.
5. Run a fresh equation through a few cheap stages.
6. Close with roadmap and tradeoffs.
