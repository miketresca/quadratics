export type NarrationStatus = "completed" | "unsupported" | "failed";

export interface AudioAlignment {
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
}

export interface NarrationSegment {
  scriptSegmentId: string;
  stepId: string;
  title: string;
  provider: "elevenlabs" | "development";
  voiceId: string;
  modelId: string;
  audioMimeType: string;
  audioBase64: string;
  durationSeconds?: number | null;
  speechText: string;
  alignment?: AudioAlignment | null;
  normalizedAlignment?: AudioAlignment | null;
  providerMetadata?: Record<string, unknown>;
}

export interface LessonNarration {
  status: NarrationStatus;
  provider: "elevenlabs" | "development" | null;
  voiceId?: string | null;
  modelId?: string | null;
  audioMimeType?: string | null;
  audioBase64?: string | null;
  durationSeconds?: number | null;
  speechText?: string | null;
  segments?: NarrationSegment[];
  alignment?: AudioAlignment | null;
  normalizedAlignment?: AudioAlignment | null;
  unsupportedReason?: string | null;
  providerMetadata?: Record<string, unknown>;
}
