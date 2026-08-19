# Video Pipeline

The future pipeline is:

```text
Lesson step
  -> script segment
  -> ElevenLabs-ready speech markup
  -> narration audio and timestamps
  -> Motion Canvas board animation
  -> optional avatar clip
  -> final composition
```

Motion Canvas remains deterministic for board and math animation. Script generation may use an LLM after deterministic lesson construction, but provider-specific LLM, narration, and avatar logic must stay behind adapters.

Script segments are the bridge between lesson steps and future media. Each segment should reference the teaching step and math-line IDs that will be visible while that narration is spoken.

The teacher script is not sent directly to ElevenLabs. It first passes through a speech-markup step that converts the higher-level teaching narration into conversational spoken math with SSML break tags. The app logs this as `elevenlabs_request`, between `teacher_script` and `elevenlabs_audio`, because that is the exact text sent to the narration provider.

Narration audio is generated per script segment, not as one long lesson-level file. For a three-step factoring lesson, the API calls the narration provider once per script segment and returns narration segments keyed by script segment ID and teaching step ID. This preserves the lesson timeline boundary that Motion Canvas needs: each audio file already maps to the board state and math lines for that step.

Per-segment audio also makes regeneration cheaper and safer. If the teacher script is good but one narration generation fails or sounds wrong, the app can retry only that segment without spending credits on a new teacher script or re-generating the other audio segments. Future caching should use the segment ID plus the segment speech text, instructor ID, voice ID, model ID, and speech settings so retries can be scoped precisely.

The UI should default to manual progression while this pipeline is still being tuned. Submitting an equation should run the deterministic solve only. A user can then run `teacher_script`, run `elevenlabs_request` plus `elevenlabs_audio`, retry individual narration segments, or choose `Run A to Z` after the solve result appears. This protects provider credits during iteration and makes each pipeline boundary visible.

Provider calls must remain auditable. Every expensive script, speech-markup, narration, avatar, or video generation attempt should eventually attach to a user-owned generation job and credit-ledger transaction with an idempotency key. This is especially important for segment retries, where one visible click may map to only one provider call.

Future cache keys should use normalized equation, method, instructor ID, voice configuration, render configuration version, and lesson template version. Raw user input is not sufficient because equivalent equations should normalize toward the same cache identity.
