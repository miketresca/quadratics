import type {GenerationArtifact, GenerationArtifactDependency} from "./artifact";
import type {Lesson} from "./lesson";

export type GenerationStatus = "pending" | "processing" | "completed" | "failed";

export interface GenerationJob {
  id: string;
  userId: string;
  equationInput: string;
  normalizedEquation?: string | null;
  equationHash?: string | null;
  instructorId?: string | null;
  status: GenerationStatus;
  creditsUsed: number;
}

export interface GenerationSnapshot {
  job: GenerationJob;
  lesson: Lesson;
  artifacts: GenerationArtifact[];
  dependencies?: GenerationArtifactDependency[];
}
