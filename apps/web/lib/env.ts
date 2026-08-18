const publicEnv = {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
};

type PublicEnvName = keyof typeof publicEnv;

export function requiredPublicEnv(name: PublicEnvName): string {
  const value = publicEnv[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

export const apiUrl = publicEnv.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
