import type {CurrentUser} from "@quadratics/types";
import {execSync} from "node:child_process";
import {readFile} from "node:fs/promises";
import path from "node:path";

import {AppModeShell} from "@/components/app-mode-shell";
import {AppHeader, type BuildInfo} from "@/components/app-header";
import {
  getLatestGenerationVideos,
  getMe,
  getPublicLatestRenderVideos,
  getUsageEvents,
  getUsageSummary,
  type LatestGenerationVideo,
  type PublicLatestRenderVideo
} from "@/lib/api";
import {createClient} from "@/lib/supabase/server";

const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const readmePath = path.resolve(process.cwd(), "../..", "README.md");
export default async function AppPage({
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

  const user =
    sessionToken !== null
      ? await getMe(sessionToken).catch(() => sessionUserFallback)
      : null;
  const usageSummary =
    sessionToken !== null
      ? await getUsageSummary(sessionToken).catch(() => null)
      : null;
  const usageEvents =
    sessionToken !== null
      ? await getUsageEvents(sessionToken).then((response) => response.events).catch(() => [])
      : [];
  const latestRenderVideos =
    sessionToken !== null
      ? await getLatestGenerationVideos(sessionToken)
          .then((response) => response.videos.map(latestGenerationVideoToPublicRenderVideo).filter(isPublicLatestRenderVideo))
          .catch(() => [])
      : await getPublicLatestRenderVideos().then((response) => response.videos).catch(() => []);
  const readmeMarkdown = await readFile(readmePath, "utf8");
  const buildInfo = getBuildInfo();

  return (
    <main className="quadratics-app-bg min-h-screen bg-black text-zinc-100">
      <AppHeader
        buildInfo={buildInfo}
        loginError={loginError}
        usageEvents={usageEvents}
        usageSummary={usageSummary}
        user={user}
      />
      <AppModeShell
        initialLatestRenderVideos={latestRenderVideos}
        initialUser={user}
        readmeMarkdown={readmeMarkdown}
      />
    </main>
  );
}

function latestGenerationVideoToPublicRenderVideo(video: LatestGenerationVideo): PublicLatestRenderVideo | null {
  if (!video.artifact) {
    return null;
  }
  return {
    generationId: video.job.id,
    equationInput: video.job.equationInput,
    stage: video.artifact.stage,
    status: video.artifact.status,
    storageObjects: video.artifact.storageObjects ?? [],
    createdAt: video.artifact.createdAt,
    completedAt: video.artifact.completedAt
  };
}

function isPublicLatestRenderVideo(value: PublicLatestRenderVideo | null): value is PublicLatestRenderVideo {
  return value !== null;
}

function getBuildInfo(): BuildInfo {
  try {
    const output = execSync("git log -1 --format=%h%x00%s%x00%cI", {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    const [commit, subject, committedAt] = output.split("\0");
    if (commit && subject) {
      return {commit, committedAt: committedAt ?? null, subject};
    }
  } catch {
    // Deployment environments do not always expose the .git directory.
  }

  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA;
  const subject = process.env.VERCEL_GIT_COMMIT_MESSAGE ?? process.env.GIT_COMMIT_MESSAGE;
  return {
    commit: sha ? sha.slice(0, 7) : "local",
    committedAt: null,
    subject: subject ?? (sha ? "deployed build" : "local build")
  };
}
