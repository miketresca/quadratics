import type {ResolvedAnimationTimeline, ResolvedSfxWindow} from "@quadratics/types";

export interface ChalkSfxTrack {
  type: "chalk_write";
  startSeconds: number;
  endSeconds: number;
  gain: number;
}

export const defaultChalkGain = 0.18;

export function chalkSfxTracksForTimeline(
  timeline: ResolvedAnimationTimeline,
  options: {gain?: number} = {},
): ChalkSfxTrack[] {
  const gain = options.gain ?? defaultChalkGain;
  return timeline.cues
    .map((cue) => cue.sfx)
    .filter((sfx): sfx is ResolvedSfxWindow => sfx?.type === "chalk_write")
    .map((sfx) => ({
      type: "chalk_write",
      startSeconds: sfx.startSeconds,
      endSeconds: sfx.endSeconds,
      gain
    }));
}
