# Video Pipeline

The future pipeline is:

```text
Lesson step
  -> narration text
  -> narration audio and timestamps
  -> Motion Canvas board animation
  -> optional avatar clip
  -> final composition
```

Motion Canvas remains deterministic for board and math animation. Provider-specific narration and avatar logic must stay behind adapters.

Future cache keys should use normalized equation, method, instructor ID, voice configuration, render configuration version, and lesson template version. Raw user input is not sufficient because equivalent equations should normalize toward the same cache identity.
