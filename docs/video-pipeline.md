# Video Pipeline

The future pipeline is:

```text
Lesson step
  -> script segment
  -> narration text
  -> narration audio and timestamps
  -> Motion Canvas board animation
  -> optional avatar clip
  -> final composition
```

Motion Canvas remains deterministic for board and math animation. Script generation may use an LLM after deterministic lesson construction, but provider-specific LLM, narration, and avatar logic must stay behind adapters.

Script segments are the bridge between lesson steps and future media. Each segment should reference the teaching step and math-line IDs that will be visible while that narration is spoken.

Future cache keys should use normalized equation, method, instructor ID, voice configuration, render configuration version, and lesson template version. Raw user input is not sufficient because equivalent equations should normalize toward the same cache identity.
