import type {Lesson, SolutionMethod} from "./lesson";
import type {LessonNarration} from "./narration";

export type ScriptStatus = "completed" | "unsupported" | "failed";
export type OutputMode = "video_audio" | "audio";

export interface ScriptSegment {
  id: string;
  stepId: string;
  title: string;
  narration: string;
  mathLineIds: string[];
  estimatedSeconds: number;
  wordCount: number;
  deliveryNotes?: string[];
}

export interface LessonScript {
  status: ScriptStatus;
  method: SolutionMethod | null;
  totalEstimatedSeconds: number;
  totalWordCount: number;
  segments: ScriptSegment[];
  unsupportedReason?: string | null;
  providerMetadata?: Record<string, unknown>;
}

export interface ScriptEquationRequest {
  equation: string;
  instructorId?: string | null;
  outputMode?: OutputMode;
}

export interface ScriptEquationResponse {
  lesson: Lesson;
  script: LessonScript;
}

export interface NarrationEquationRequest {
  script: LessonScript;
  instructorId?: string | null;
  outputMode?: OutputMode;
  scriptSegmentId?: string | null;
}

export interface NarrationEquationResponse {
  narration: LessonNarration;
}
