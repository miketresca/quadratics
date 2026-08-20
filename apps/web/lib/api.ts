import type {
  CreateGenerationResponse,
  GenerationSnapshot,
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
