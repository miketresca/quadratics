import type {LessonNarration} from "@quadratics/types";

export function mergeNarrationSegmentRetry(
  previousNarration: LessonNarration,
  replacementNarration: LessonNarration,
): LessonNarration {
  if (previousNarration.status !== "completed" || replacementNarration.status !== "completed") {
    return {
      ...previousNarration,
      unsupportedReason:
        replacementNarration.unsupportedReason ?? "Could not regenerate this audio segment."
    };
  }
  const replacementSegment = replacementNarration.segments?.[0];
  if (!replacementSegment || !previousNarration.segments) {
    return replacementNarration;
  }

  const segments = previousNarration.segments.map((segment) =>
    segment.scriptSegmentId === replacementSegment.scriptSegmentId ? replacementSegment : segment
  );
  const durationSeconds = segments.reduce(
    (total, segment) => total + (segment.durationSeconds ?? 0),
    0
  );
  return {
    ...previousNarration,
    durationSeconds,
    speechText: segments.map((segment) => segment.speechText).join(" "),
    segments,
    unsupportedReason: null
  };
}
