import type {GameProgress, GameProgressUpdateRequest} from "@quadratics/types";

import {apiUrl} from "@/lib/env";

export async function getGameProgress(accessToken: string): Promise<GameProgress> {
  const response = await fetch(`${apiUrl}/api/v1/game/me/progress`, {
    headers: {Authorization: `Bearer ${accessToken}`},
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error("Could not load game progress");
  }
  return response.json() as Promise<GameProgress>;
}

export async function updateGameProgress(params: {
  accessToken: string;
  request: GameProgressUpdateRequest;
}): Promise<GameProgress> {
  const response = await fetch(`${apiUrl}/api/v1/game/me/progress`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(params.request)
  });
  if (!response.ok) {
    const text = await response.text();
    const body = tryParseJson(text) as {detail?: string} | null;
    throw new Error(body?.detail ?? (text || "Could not update game progress"));
  }
  return response.json() as Promise<GameProgress>;
}

export async function resetGameProgress(accessToken: string): Promise<GameProgress> {
  const response = await fetch(`${apiUrl}/api/v1/game/me/progress/reset`, {
    method: "POST",
    headers: {Authorization: `Bearer ${accessToken}`}
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {detail?: string} | null;
    throw new Error(body?.detail ?? "Could not reset game progress");
  }
  return response.json() as Promise<GameProgress>;
}

function tryParseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
