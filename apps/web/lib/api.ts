import type {MeResponse, OutputMode, ScriptEquationResponse, SolveEquationResponse} from "@quadratics/types";

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
