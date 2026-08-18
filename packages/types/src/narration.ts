export type NarrationStatus = "completed" | "unsupported" | "failed";

export interface AudioAlignment {
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
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
  alignment?: AudioAlignment | null;
  normalizedAlignment?: AudioAlignment | null;
  unsupportedReason?: string | null;
  providerMetadata?: Record<string, unknown>;
}
