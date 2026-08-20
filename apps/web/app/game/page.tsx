import type {CurrentUser, GameFighterId} from "@quadratics/types";

import {AppHeader} from "@/components/app-header";
import {GameShell} from "@/components/game/game-shell";
import {getMe, getUsageEvents, getUsageSummary} from "@/lib/api";
import {getBuildInfo} from "@/lib/build-info";
import {GAME_FIGHTERS} from "@/lib/game/assets";
import {createClient} from "@/lib/supabase/server";

const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default async function GamePage({
  searchParams
}: {
  searchParams: Promise<{auth_error?: string; fighter?: string; preview?: string}>;
}) {
  const params = await searchParams;
  const loginError = params.auth_error === "invalid_credentials" ? "Username or password was not accepted." : null;
  const developmentPreview = process.env.NODE_ENV === "development" && params.preview === "arena";
  const previewFighterId = developmentPreview ? validPreviewFighter(params.fighter) : null;
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
  const usageSummary = sessionToken !== null ? await getUsageSummary(sessionToken).catch(() => null) : null;
  const usageEvents = sessionToken !== null ? await getUsageEvents(sessionToken).then((response) => response.events).catch(() => []) : [];

  return (
    <main className="quadratics-app-bg min-h-screen bg-black text-zinc-100">
      <AppHeader
        buildInfo={getBuildInfo()}
        loginError={loginError}
        returnTo="/game"
        usageEvents={usageEvents}
        usageSummary={usageSummary}
        user={user}
      />
      <GameShell initialFighterId={previewFighterId} initialMode={developmentPreview ? "arena" : undefined} initialUser={user} />
    </main>
  );
}

function validPreviewFighter(value: string | undefined): GameFighterId | null {
  return GAME_FIGHTERS.some((fighter) => fighter.id === value) ? (value as GameFighterId) : "mario";
}
