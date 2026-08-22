import type {
  CreateGenerationResponse,
  GenerationSnapshot,
  GenerationArtifact,
  Instructor,
  MeResponse,
  NarrationEquationResponse,
  OutputMode,
  ProviderKeyMetadata,
  ProviderKeyName,
  ProviderKeysResponse,
  LessonScript,
  ScriptEquationResponse,
  SolveEquationResponse,
  UsageEventsResponse,
  UsageSummary
} from "@quadratics/types";

import {apiUrl} from "@/lib/env";

export async function getMe(accessToken: string): Promise<MeResponse> {
  const response = await fetch(`${apiUrl}/api/v1/me`, {
    headers: {Authorization: `Bearer ${accessToken}`},
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error("Could not load user profile");
  }
  return response.json() as Promise<MeResponse>;
}

export async function solveEquation(params: {
  accessToken: string;
  equation: string;
  instructorId: string;
}): Promise<SolveEquationResponse> {
  const response = await fetch(`${apiUrl}/api/v1/equations/solve`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({equation: params.equation, instructorId: params.instructorId})
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {detail?: string} | null;
    throw new Error(body?.detail ?? "Could not solve the equation");
  }
  return response.json() as Promise<SolveEquationResponse>;
}

export async function createGeneration(params: {
  accessToken: string;
  equation: string;
  instructorId: string;
}): Promise<CreateGenerationResponse> {
  const response = await fetch(`${apiUrl}/api/v1/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({equation: params.equation, instructorId: params.instructorId})
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {detail?: string} | null;
    throw new Error(body?.detail ?? "Could not create the generation");
  }
  return response.json() as Promise<CreateGenerationResponse>;
}

export async function getLatestGeneration(accessToken: string): Promise<GenerationSnapshot | null> {
  const response = await fetch(`${apiUrl}/api/v1/generations/latest`, {
    headers: {Authorization: `Bearer ${accessToken}`},
    cache: "no-store"
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {detail?: string} | null;
    throw new Error(body?.detail ?? "Could not load the latest generation");
  }
  return response.json() as Promise<GenerationSnapshot | null>;
}

export type LatestGenerationVideo = {
  job: GenerationSnapshot["job"];
  artifact: GenerationArtifact | null;
};

export type LatestGenerationVideosResponse = {
  videos: LatestGenerationVideo[];
};

export type PublicLatestRenderVideo = {
  generationId: string;
  equationInput: string;
  stage: GenerationArtifact["stage"];
  status: GenerationArtifact["status"];
  storageObjects: NonNullable<GenerationArtifact["storageObjects"]>;
  createdAt: string;
  completedAt?: string | null;
};

export type PublicLatestRenderVideosResponse = {
  videos: PublicLatestRenderVideo[];
};

export type GameLessonStage =
  | "template"
  | "section_script"
  | "speech_markup"
  | "narration"
  | "handwriting"
  | "interactive_bundle"
  | "lesson_publish";

export type GameLessonArtifactStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "stale"
  | "awaiting_approval"
  | "approved"
  | "rejected";

export type GameLessonArtifact = {
  id: string;
  runId: string;
  stage: GameLessonStage;
  status: GameLessonArtifactStatus;
  version: number;
  payload: Record<string, unknown>;
  summary: string | null;
  errorMessage: string | null;
  isCurrent: boolean;
  staleReason: string | null;
  providerName: string | null;
  modelName: string | null;
  configMetadata: Record<string, unknown>;
  createdAt: string;
  completedAt: string | null;
};

export type GameWorksheetRunSnapshot = {
  id: string;
  templateId: string;
  userId: string;
  selectedInstructorId: string | null;
  status: "created" | "running" | "completed" | "failed";
  templateTitle: string;
  templatePayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  artifacts: GameLessonArtifact[];
};

export type GameUsageBreakdownItem = {
  provider: string;
  stage: string;
  unitType: string;
  quantity: number;
  costUsd: number;
};

export type GameUsageSummary = {
  userTotalCostUsd: number;
  userTotalQuantity: number;
  userBreakdown: GameUsageBreakdownItem[];
  globalAverageCostPerLessonUsd: number;
  globalCompletedLessonCount: number;
  globalBreakdown: GameUsageBreakdownItem[];
};

export type GameUsageEventItem = {
  id: string;
  createdAt: string;
  runId: string | null;
  artifactId: string | null;
  provider: string;
  stage: string;
  model: string | null;
  unitType: string;
  quantity: number;
  unitCostUsd: number;
  totalCostUsd: number;
};

export type GameUsageEventsResponse = {
  events: GameUsageEventItem[];
};

type ApiGameWorksheetRunSnapshot = {
  id: string;
  templateId: string;
  userId: string;
  selectedInstructorId: string | null;
  status: "active" | "completed" | "failed";
  template: {
    id: string;
    title: string;
    version: number;
    payload: Record<string, unknown>;
  };
  artifacts: ApiGameLessonArtifact[];
  createdAt: string;
  updatedAt: string;
};

type ApiGameLessonArtifact = {
  id: string;
  runId: string;
  stage: GameLessonStage;
  version: number;
  status: GameLessonArtifactStatus | "awaiting_approval";
  isCurrent: boolean;
  payload: Record<string, unknown>;
  storageRefs: Array<Record<string, unknown>>;
  errorMessage: string | null;
  staleReason: string | null;
  configMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

function normalizeGameLessonRun(snapshot: ApiGameWorksheetRunSnapshot): GameWorksheetRunSnapshot {
  return {
    id: snapshot.id,
    templateId: snapshot.templateId,
    userId: snapshot.userId,
    selectedInstructorId: snapshot.selectedInstructorId,
    status: snapshot.status === "active" ? "running" : snapshot.status,
    templateTitle: snapshot.template.title,
    templatePayload: snapshot.template.payload,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    artifacts: snapshot.artifacts.map((artifact) => ({
      id: artifact.id,
      runId: artifact.runId,
      stage: artifact.stage,
      status: artifact.status,
      version: artifact.version,
      payload: artifact.payload,
      summary: typeof artifact.payload.summary === "string" ? artifact.payload.summary : null,
      errorMessage: artifact.errorMessage,
      isCurrent: artifact.isCurrent,
      staleReason: artifact.staleReason,
      providerName: typeof artifact.configMetadata.provider === "string" ? artifact.configMetadata.provider : null,
      modelName: typeof artifact.configMetadata.model === "string" ? artifact.configMetadata.model : null,
      configMetadata: artifact.configMetadata,
      createdAt: artifact.createdAt,
      completedAt: artifact.status === "completed" || artifact.status === "approved" ? artifact.updatedAt : null
    }))
  };
}

export async function createGameLessonRun(params: {
  accessToken: string;
  selectedInstructorId?: string | null;
  templateId: string;
}): Promise<GameWorksheetRunSnapshot> {
  const response = await fetch(`${apiUrl}/api/v1/game/lessons/${params.templateId}/runs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({selectedInstructorId: params.selectedInstructorId ?? null})
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {detail?: string} | null;
    throw new Error(body?.detail ?? "Could not create the worksheet run");
  }
  return normalizeGameLessonRun((await response.json()) as ApiGameWorksheetRunSnapshot);
}

export async function getGameLessonRun(params: {
  accessToken: string;
  runId: string;
}): Promise<GameWorksheetRunSnapshot> {
  const response = await fetch(`${apiUrl}/api/v1/game/lesson-runs/${params.runId}`, {
    headers: {Authorization: `Bearer ${params.accessToken}`},
    cache: "no-store"
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {detail?: string} | null;
    throw new Error(body?.detail ?? "Could not load the worksheet run");
  }
  return normalizeGameLessonRun((await response.json()) as ApiGameWorksheetRunSnapshot);
}

export async function runGameLessonStage(params: {
  accessToken: string;
  force?: boolean;
  runId: string;
  stage: GameLessonStage;
}): Promise<GameWorksheetRunSnapshot> {
  const url = `${apiUrl}/api/v1/game/lesson-runs/${params.runId}/stages/${params.stage}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({force: params.force ?? false})
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "network request failed";
    throw new Error(`Could not reach API while running ${params.stage} at ${url}: ${message}`);
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {detail?: string} | null;
    const detail = body?.detail ?? `Could not run ${params.stage}`;
    throw new Error(`${params.stage} failed (${response.status}) at ${url}: ${detail}`);
  }
  return normalizeGameLessonRun((await response.json()) as ApiGameWorksheetRunSnapshot);
}

export async function approveGameLessonArtifact(params: {
  accessToken: string;
  artifactId: string;
  decision: "approved" | "rejected";
  notes?: string | null;
}): Promise<{decision: "approved" | "rejected"}> {
  const response = await fetch(`${apiUrl}/api/v1/game/artifacts/${params.artifactId}/approve`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({decision: params.decision, notes: params.notes ?? null})
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {detail?: string} | null;
    throw new Error(body?.detail ?? "Could not approve the worksheet artifact");
  }
  return (await response.json()) as {decision: "approved" | "rejected"};
}

export async function getGameUsageSummary(accessToken: string): Promise<GameUsageSummary> {
  const response = await fetch(`${apiUrl}/api/v1/game/usage/summary`, {
    headers: {Authorization: `Bearer ${accessToken}`},
    cache: "no-store"
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {detail?: string} | null;
    throw new Error(body?.detail ?? "Could not load game usage summary");
  }
  return response.json() as Promise<GameUsageSummary>;
}

export async function getGameUsageEvents(accessToken: string, limit = 30): Promise<GameUsageEventsResponse> {
  const response = await fetch(`${apiUrl}/api/v1/game/usage/events?limit=${limit}`, {
    headers: {Authorization: `Bearer ${accessToken}`},
    cache: "no-store"
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {detail?: string} | null;
    throw new Error(body?.detail ?? "Could not load game usage events");
  }
  return response.json() as Promise<GameUsageEventsResponse>;
}

export async function getLatestGenerationVideos(accessToken: string): Promise<LatestGenerationVideosResponse> {
  const response = await fetch(`${apiUrl}/api/v1/generations/latest/videos`, {
    headers: {Authorization: `Bearer ${accessToken}`},
    cache: "no-store"
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {detail?: string} | null;
    throw new Error(body?.detail ?? "Could not load the latest video generations");
  }
  return response.json() as Promise<LatestGenerationVideosResponse>;
}

export async function getPublicLatestRenderVideos(): Promise<PublicLatestRenderVideosResponse> {
  const response = await fetch(`${apiUrl}/api/v1/generations/public/latest-renders`, {
    cache: "no-store"
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {detail?: string} | null;
    throw new Error(body?.detail ?? "Could not load the latest render demos");
  }
  return response.json() as Promise<PublicLatestRenderVideosResponse>;
}

export async function runGenerationStage(params: {
  accessToken: string;
  generationId: string;
  stage: string;
  force?: boolean;
  avatarModel?: string | null;
  includeAvatar?: boolean | null;
  scriptSegmentId?: string | null;
}): Promise<GenerationSnapshot> {
  const url = `${apiUrl}/api/v1/generations/${params.generationId}/stages/${params.stage}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      force: params.force ?? false,
      avatarModel: params.avatarModel,
      includeAvatar: params.includeAvatar,
      scriptSegmentId: params.scriptSegmentId
    })
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "network request failed";
    throw new Error(`Could not reach API while running ${params.stage} at ${url}: ${message}`);
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {detail?: string} | null;
    throw new Error(body?.detail ?? `Could not run ${params.stage}`);
  }
  return response.json() as Promise<GenerationSnapshot>;
}

export async function runGenerationPipeline(params: {
  accessToken: string;
  generationId: string;
  force?: boolean;
}): Promise<GenerationSnapshot> {
  const response = await fetch(`${apiUrl}/api/v1/generations/${params.generationId}/run-all`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({force: params.force ?? false})
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {detail?: string} | null;
    throw new Error(body?.detail ?? "Could not run the full pipeline");
  }
  return response.json() as Promise<GenerationSnapshot>;
}

export async function listInstructors(accessToken: string): Promise<Instructor[]> {
  const response = await fetch(`${apiUrl}/api/v1/instructors`, {
    headers: {Authorization: `Bearer ${accessToken}`},
    cache: "no-store"
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {detail?: string} | null;
    throw new Error(body?.detail ?? "Could not load instructors");
  }
  return response.json() as Promise<Instructor[]>;
}

export async function listPublicInstructors(): Promise<Instructor[]> {
  const response = await fetch(`${apiUrl}/api/v1/instructors/public`, {
    cache: "no-store"
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {detail?: string} | null;
    throw new Error(body?.detail ?? "Could not load instructors");
  }
  return response.json() as Promise<Instructor[]>;
}

export async function getUsageSummary(accessToken: string): Promise<UsageSummary> {
  const response = await fetch(`${apiUrl}/api/v1/usage/summary`, {
    headers: {Authorization: `Bearer ${accessToken}`},
    cache: "no-store"
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {detail?: string} | null;
    throw new Error(body?.detail ?? "Could not load usage summary");
  }
  return response.json() as Promise<UsageSummary>;
}

export async function getUsageEvents(accessToken: string, limit = 50): Promise<UsageEventsResponse> {
  const response = await fetch(`${apiUrl}/api/v1/usage/events?limit=${limit}`, {
    headers: {Authorization: `Bearer ${accessToken}`},
    cache: "no-store"
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {detail?: string} | null;
    throw new Error(body?.detail ?? "Could not load usage events");
  }
  return response.json() as Promise<UsageEventsResponse>;
}

export async function createInstructor(params: {
  accessToken: string;
  displayName: string;
  voiceId?: string | null;
  avatarId?: string | null;
  referenceImageUrl?: string | null;
  imageZoom: number;
  imageX: number;
  imageY: number;
}): Promise<Instructor> {
  const response = await fetch(`${apiUrl}/api/v1/instructors`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      displayName: params.displayName,
      voiceId: params.voiceId,
      avatarId: params.avatarId,
      referenceImageUrl: params.referenceImageUrl,
      imageZoom: params.imageZoom,
      imageX: params.imageX,
      imageY: params.imageY
    })
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {detail?: string} | null;
    throw new Error(body?.detail ?? "Could not create instructor");
  }
  return response.json() as Promise<Instructor>;
}

export async function updateInstructor(params: {
  accessToken: string;
  instructorId: string;
  displayName: string;
  voiceId?: string | null;
  avatarId?: string | null;
  referenceImageUrl?: string | null;
  imageZoom: number;
  imageX: number;
  imageY: number;
}): Promise<Instructor> {
  const response = await fetch(`${apiUrl}/api/v1/instructors/${params.instructorId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      displayName: params.displayName,
      voiceId: params.voiceId,
      avatarId: params.avatarId,
      referenceImageUrl: params.referenceImageUrl,
      imageZoom: params.imageZoom,
      imageX: params.imageX,
      imageY: params.imageY
    })
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {detail?: string} | null;
    throw new Error(body?.detail ?? "Could not update instructor");
  }
  return response.json() as Promise<Instructor>;
}

export async function deleteInstructor(params: {accessToken: string; instructorId: string}): Promise<void> {
  const response = await fetch(`${apiUrl}/api/v1/instructors/${params.instructorId}`, {
    method: "DELETE",
    headers: {Authorization: `Bearer ${params.accessToken}`}
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {detail?: string} | null;
    throw new Error(body?.detail ?? "Could not delete instructor");
  }
}

export async function generateEquationScript(params: {
  accessToken: string;
  equation: string;
  instructorId: string;
  outputMode: OutputMode;
}): Promise<ScriptEquationResponse> {
  const response = await fetch(`${apiUrl}/api/v1/equations/script`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      equation: params.equation,
      instructorId: params.instructorId,
      outputMode: params.outputMode
    })
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {detail?: string} | null;
    throw new Error(body?.detail ?? "Could not generate the script");
  }
  return response.json() as Promise<ScriptEquationResponse>;
}

export async function generateEquationNarration(params: {
  accessToken: string;
  script: LessonScript;
  instructorId: string;
  outputMode: OutputMode;
  scriptSegmentId?: string | null;
}): Promise<NarrationEquationResponse> {
  const response = await fetch(`${apiUrl}/api/v1/equations/narration`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      script: params.script,
      instructorId: params.instructorId,
      outputMode: params.outputMode,
      scriptSegmentId: params.scriptSegmentId
    })
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {detail?: string} | null;
    throw new Error(body?.detail ?? "Could not generate audio");
  }
  return response.json() as Promise<NarrationEquationResponse>;
}

export async function listProviderKeys(accessToken: string): Promise<ProviderKeysResponse> {
  const response = await fetch(`${apiUrl}/api/v1/provider-keys`, {
    headers: {Authorization: `Bearer ${accessToken}`},
    cache: "no-store"
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {detail?: string} | null;
    throw new Error(body?.detail ?? "Could not load API keys");
  }
  return response.json() as Promise<ProviderKeysResponse>;
}

export async function saveProviderKey(params: {
  accessToken: string;
  provider: ProviderKeyName;
  apiKey: string;
}): Promise<ProviderKeyMetadata> {
  const response = await fetch(`${apiUrl}/api/v1/provider-keys/${params.provider}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({provider: params.provider, apiKey: params.apiKey})
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {detail?: string} | null;
    throw new Error(body?.detail ?? "Could not save API key");
  }
  return response.json() as Promise<ProviderKeyMetadata>;
}

export async function deleteProviderKey(params: {
  accessToken: string;
  provider: ProviderKeyName;
}): Promise<void> {
  const response = await fetch(`${apiUrl}/api/v1/provider-keys/${params.provider}`, {
    method: "DELETE",
    headers: {Authorization: `Bearer ${params.accessToken}`}
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {detail?: string} | null;
    throw new Error(body?.detail ?? "Could not delete API key");
  }
}
