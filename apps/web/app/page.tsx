import type {CurrentUser} from "@quadratics/types";

import {GameShell} from "@/components/game/game-shell";
import {getMe} from "@/lib/api";
import {createClient} from "@/lib/supabase/server";

const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<{auth_error?: string}>;
}) {
  const params = await searchParams;
  const loginError = params.auth_error === "invalid_credentials" ? "Username or password was not accepted." : null;
  let sessionToken: string | null = null;
  let sessionUserFallback: CurrentUser | null = null;

  if (supabaseConfigured) {
    const supabase = await createClient();
    const {
      data: {session}
    } = await supabase.auth.getSession();

    sessionToken = session?.access_token ?? null;
    sessionUserFallback = session?.user
      ? {
          id: session.user.id,
          email: session.user.email ?? "user@example.com",
          displayName: null,
          creditBalance: 0
        }
      : null;
  }

  const user = sessionToken !== null ? await getMe(sessionToken).catch(() => sessionUserFallback) : null;

  return (
    <main className="min-h-screen bg-[#1c120a] text-zinc-100">
      <GameShell initialLoginError={loginError} initialUser={user} />
    </main>
  );
}
