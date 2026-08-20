import {execSync} from "node:child_process";

import type {BuildInfo} from "@/components/app-header";

export function getBuildInfo(): BuildInfo {
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
