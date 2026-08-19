import {describe, expect, it} from "vitest";

import {mergeNarrationSegmentRetry} from "../lib/narration";

describe("narration helpers", () => {
  it("replaces one completed narration segment without dropping the others", () => {
    const merged = mergeNarrationSegmentRetry(
      {
        status: "completed",
        provider: "elevenlabs",
        durationSeconds: 6,
        speechText: "Old factor. Old solve.",
        segments: [
          segment("script_factor", "Old factor.", 2),
          segment("script_solve_factors", "Old solve.", 4)
        ]
      },
      {
        status: "completed",
        provider: "elevenlabs",
        durationSeconds: 3,
        speechText: "New solve.",
        segments: [segment("script_solve_factors", "New solve.", 3)]
      }
    );

    expect(merged.durationSeconds).toBe(5);
    expect(merged.speechText).toBe("Old factor. New solve.");
    expect(merged.segments?.map((item) => item.speechText)).toEqual([
      "Old factor.",
      "New solve."
    ]);
  });

  it("preserves existing audio when one segment retry fails", () => {
    const merged = mergeNarrationSegmentRetry(
      {
        status: "completed",
        provider: "elevenlabs",
        durationSeconds: 6,
        speechText: "Old factor. Old solve.",
        segments: [
          segment("script_factor", "Old factor.", 2),
          segment("script_solve_factors", "Old solve.", 4)
        ]
      },
      {
        status: "unsupported",
        provider: null,
        unsupportedReason: "ElevenLabs rejected this segment.",
        speechText: "New solve attempt."
      }
    );

    expect(merged.status).toBe("completed");
    expect(merged.unsupportedReason).toBe("ElevenLabs rejected this segment.");
    expect(merged.segments?.map((item) => item.speechText)).toEqual([
      "Old factor.",
      "Old solve."
    ]);
  });
});

function segment(scriptSegmentId: string, speechText: string, durationSeconds: number) {
  return {
    scriptSegmentId,
    stepId: scriptSegmentId.replace("script_", ""),
    title: scriptSegmentId,
    provider: "elevenlabs",
    voiceId: "male-voice",
    modelId: "eleven_multilingual_v2",
    audioMimeType: "audio/mpeg",
    audioBase64: "ZmFrZQ==",
    durationSeconds,
    speechText
  } as const;
}
