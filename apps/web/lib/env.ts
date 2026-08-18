export function requiredPublicEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const devAuthBypass = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";
