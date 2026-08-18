import {createServerClient} from "@supabase/ssr";
import {cookies} from "next/headers";

import {requiredPublicEnv} from "@/lib/env";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    requiredPublicEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredPublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({name, value, options}) => cookieStore.set(name, value, options));
          } catch {
            // Server components cannot always write cookies; middleware refresh handles the session.
          }
        }
      }
    }
  );
}
