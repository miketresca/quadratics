export type ArtifactStatus = "pending" | "running" | "completed" | "failed" | "stale" | "skipped";

export type ArtifactStage =
  | "solution"
  | "lesson"
  | "real_world_context"
  | "teacher_script"
  | "elevenlabs_request"
  | "elevenlabs_audio"
  | "animation_plan"
  | "resolved_timeline"
  | "motion_canvas_render"
  | "base_video"
  | "heygen_avatar"
  | "avatar_composition"
  | "final_video";

export interface ArtifactStorageObject {
  bucket: string;
  path: string;
  signedUrl?: string | null;
  contentType?: string | null;
  sizeBytes?: number | null;
  checksumSha256?: string | null;
  durationSeconds?: number | null;
  metadata?: Record<string, unknown>;
}

export interface GenerationArtifact {
  id: string;
  generationJobId: string;
  userId: string;
  stage: ArtifactStage;
  version: number;
  status: ArtifactStatus;
  inputHash: string;
  upstreamArtifactIds?: string[];
  provider?: string | null;
  model?: string | null;
  configMetadata?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  storageObjects?: ArtifactStorageObject[];
  isCurrent?: boolean;
  cacheHit?: boolean;
  staleReason?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface GenerationArtifactDependency {
  generationJobId: string;
  upstreamArtifactId: string;
  downstreamArtifactId: string;
  dependencyHash?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
