# Golden fixture audio

This fixture intentionally does not commit a licensed narration MP3.

For local Motion Canvas iteration, place a matching development narration file at:

```text
fixtures/golden/x2-plus-5x-plus-6/audio/narration.mp3
```

The committed `narration.json` preserves provider-shaped ElevenLabs alignment and segment offsets so timing and renderer work can run without OpenAI or ElevenLabs credentials. A later render slice may synthesize a placeholder audio file when this MP3 is absent.
