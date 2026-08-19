export type AnimationPrimitive =
  | "write_math"
  | "write_text"
  | "highlight"
  | "emphasize"
  | "circle"
  | "underline"
  | "box"
  | "arrow"
  | "erase_annotation"
  | "replace_fragment"
  | "pause"
  | "point"
  | "dim"
  | "restore";

export type AnimationSyncMode =
  | "before_narration"
  | "with_narration"
  | "after_narration"
  | "through_narration";

export interface AnimationTrigger {
  type: "narration_text";
  scriptSegmentId: string;
  text: string;
  occurrence?: number | null;
}

export interface AnimationTarget {
  lessonStepId?: string | null;
  mathLineId?: string | null;
  fragment?: string | null;
}

export interface AnimationVisual {
  action: AnimationPrimitive;
  target?: AnimationTarget | null;
  text?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AnimationSync {
  mode: AnimationSyncMode;
}

export interface AnimationCue {
  id: string;
  lessonStepId: string;
  mathLineId?: string | null;
  trigger: AnimationTrigger;
  visual: AnimationVisual;
  sync: AnimationSync;
  metadata?: Record<string, unknown>;
}

export interface BlackboardLayout {
  theme: "chalkboard";
  verticalFlow: boolean;
}

export interface AnimationPlan {
  version: "animation-plan/v1";
  lessonArtifactId: string;
  narrationArtifactId: string;
  durationSeconds?: number | null;
  layout: BlackboardLayout;
  cues: AnimationCue[];
  soundCues?: Record<string, unknown>[];
  metadata?: Record<string, unknown>;
}
