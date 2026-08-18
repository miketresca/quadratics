import type {
  MeResponse,
  OutputMode,
  ProviderKeyMetadata,
  ProviderKeyName,
  ProviderKeysResponse,
  ScriptEquationResponse,
  SolveEquationResponse
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
