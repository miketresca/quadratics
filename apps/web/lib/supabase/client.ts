import {createBrowserClient} from "@supabase/ssr";

import {requiredPublicEnv} from "@/lib/env";

export function createClient() {
  return createBrowserClient(
    requiredPublicEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredPublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
}
