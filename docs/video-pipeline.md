# Video Pipeline

Quadratics is moving toward a build-system style pipeline. Each stage consumes persisted upstream artifacts and produces a persisted downstream artifact. Downstream stages can be rerun without rerunning expensive upstream stages when the input hash still matches.

Current stage order:

```text
equation input
  -> solution
  -> lesson
  -> teacher_script
  -> elevenlabs_request
  -> elevenlabs_audio
  -> animation_plan
  -> resolved_timeline
  -> motion_canvas_render
  -> base_video
```

The user-facing `Audio only` option means no optional avatar. It does not mean no board animation or no video. The standard non-avatar pipeline still produces the base educational blackboard video. Future avatar stages should be modeled as skipped only when avatar output is disabled.

## Artifacts

Artifacts use the shared stage lifecycle:

```text
pending | running | completed | failed | stale | skipped
```

Each artifact records its generation job, user, stage, version, input hash, upstream artifact IDs, provider/model/config metadata, cache-hit state, storage references, timestamps, and error/stale details when relevant.

Stale artifacts remain inspectable. They should not be shown as the current final output, but they are useful for debugging older plans, timelines, and render attempts.

Normal reruns reuse a completed artifact when the input hash is unchanged. Force reruns ignore the cache, create a new artifact version, and stale affected downstream artifacts.

## Narration

`teacher_script` is the high-level teaching narration. It must reference existing teaching-step and math-line IDs.

`elevenlabs_request` is the provider-ready speech text, including conversational math phrasing and SSML break tags. This log exists between script and audio so the exact request text can be inspected before the narration provider is called.

`elevenlabs_audio` stores narration metadata, per-segment timing, raw and normalized ElevenLabs alignment, and private media references. The primary persisted contract should use storage object metadata rather than embedding MP3 base64.

ElevenLabs character alignment is the timestamp source of truth. Do not send rendered audio to another model to rediscover timings.

## Animation

`animation_plan` is semantic. The OpenAI planner decides what should happen visually and which narration phrase triggers it. It must use the constrained primitive vocabulary, not arbitrary Motion Canvas code.

`resolved_timeline` is deterministic. It maps planner trigger phrases to ElevenLabs character timestamps and derives exact animation and chalk-SFX windows.

Motion Canvas consumes lesson display data plus the resolved timeline. The renderer should remain generic and data-driven: math accumulates vertically on a chalkboard, and temporary highlights or annotations direct attention without erasing prior work.

The API render boundary is command-backed. Set:

```env
MOTION_CANVAS_RENDER_COMMAND=pnpm --filter @quadratics/video render
```

The command receives `QUADRATICS_RENDER_INPUT_PATH` and `QUADRATICS_RENDER_OUTPUT_PATH`. The current local command writes the generation render input into the Motion Canvas app, renders frames through `?render`, downloads the signed narration segment URLs when the API provides them, concatenates those segments, then muxes the narration into the MP4 with `ffmpeg`. If no signed narration URLs are present, it still produces a silent visual render for fixture/development work.

Chalk SFX windows are part of the resolved timeline contract. Actual chalk-audio mixing should use a licensed local asset from `apps/video/public/audio/chalk-write.mp3`; the repository does not commit third-party samples.

## Development Fixture

Use the golden fixture workflow when iterating on Motion Canvas or timing behavior:

```sh
pnpm video:fixture
```

The fixture covers `x^2 + 5x + 6 = 0` and includes lesson, script, narration-shaped metadata, animation plan, and resolved timeline data. It is designed to run without OpenAI or ElevenLabs credentials.

## Current Limits

The API now has Supabase-backed artifact repositories, Supabase Storage media upload, signed playback URL support, and a command-backed render adapter. Local/test runs without Supabase or render-command configuration still use in-memory repositories and the development renderer.

The remaining production hardening is mostly operational: run migrations in the target Supabase project, provide a Chrome/ffmpeg-capable render environment, and decide whether render workers should run inside the API process or as a separate worker.
