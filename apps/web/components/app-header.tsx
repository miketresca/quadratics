import type {CurrentUser, UsageEventItem, UsageSummary} from "@quadratics/types";

import {signIn, signOut} from "@/app/auth/actions";
import {ApiKeysDialog} from "@/components/api-keys-dialog";
import {OutsideCloseDetails} from "@/components/outside-close-details";
import {UsageCostChip} from "@/components/usage-cost-chip";

export type BuildInfo = {
  commit: string;
  committedAt: string | null;
  subject: string;
};

export function AppHeader({
  buildInfo,
  loginError,
  returnTo = "/",
  usageEvents,
  usageSummary,
  user
}: {
  buildInfo: BuildInfo;
  loginError: string | null;
  returnTo?: string;
  usageEvents: UsageEventItem[];
  usageSummary: UsageSummary | null;
  user: CurrentUser | null;
}) {
  return (
    <header className="fixed left-0 top-0 z-[400] flex w-full items-center justify-between px-5 py-5 sm:px-8">
      <Logo />
      <UsageCostChip events={usageEvents} signedIn={user !== null} summary={usageSummary} />
      <div className="flex items-center gap-2">
        <BuildChip buildInfo={buildInfo} />
        <a
          aria-label="Open quadratics GitHub repository"
          className="flex h-10 w-10 items-center justify-center rounded border border-zinc-800 bg-zinc-950/40 text-zinc-300 hover:border-emerald-400/70 hover:text-emerald-300"
          href="https://github.com/miketresca/quadratics"
          rel="noreferrer"
          target="_blank"
        >
          <GithubIcon />
        </a>
        <AccountMenu loginError={loginError} returnTo={returnTo} user={user} />
      </div>
    </header>
  );
}

function BuildChip({buildInfo}: {buildInfo: BuildInfo}) {
  return (
    <div
      aria-label={`Current build ${buildInfo.commit}, ${buildInfo.subject}`}
      className="hidden h-10 items-center gap-2 rounded border border-emerald-400/20 bg-black/45 px-3 font-mono text-[11px] tracking-wide text-emerald-300/90 shadow-[0_0_24px_rgba(16,185,129,0.08)] sm:flex"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.85)]" />
      <span className="uppercase">{buildInfo.commit}</span>
      <span className="text-zinc-600">/</span>
      <span className="group/build relative inline-flex h-5 w-5 items-center justify-center">
        <span
          aria-label={`Build details for ${buildInfo.commit}`}
          className="flex h-4 w-4 items-center justify-center rounded-full text-emerald-200/70 transition hover:text-emerald-200 focus:outline-none focus:ring-1 focus:ring-emerald-300/60"
          tabIndex={0}
        >
          <BuildInfoIcon />
        </span>
        <span className="pointer-events-none absolute right-0 top-7 z-[320] hidden w-72 rounded border border-zinc-700 bg-[#090d14] p-3 text-left text-xs normal-case leading-5 tracking-normal text-zinc-200 shadow-2xl shadow-black/60 group-hover/build:block group-focus-within/build:block">
          <span className="block font-mono text-[11px] uppercase tracking-wide text-emerald-300">{buildInfo.commit}</span>
          <span className="mt-1 block font-sans text-zinc-300">{buildInfo.subject}</span>
          <span className="mt-2 block font-mono text-[10px] uppercase tracking-wide text-zinc-500">
            {buildInfo.committedAt ? formatBuildTime(buildInfo.committedAt) : "Commit time unavailable"}
          </span>
        </span>
      </span>
    </div>
  );
}

function formatBuildTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(date);
}

function BuildInfoIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10.5v5" strokeLinecap="round" />
      <path d="M12 7.5h.01" strokeLinecap="round" />
    </svg>
  );
}

function AccountMenu({
  loginError,
  returnTo,
  user
}: {
  loginError: string | null;
  returnTo: string;
  user: CurrentUser | null;
}) {
  const label = accountLabel(user);
  const canSignOut = user !== null;

  return (
    <OutsideCloseDetails className="group relative" initialOpen={loginError !== null}>
      <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded border border-zinc-800 bg-zinc-950/40 px-3 text-sm text-zinc-200 hover:border-emerald-400/70 hover:text-emerald-300 [&::-webkit-details-marker]:hidden">
        <span className="max-w-36 truncate">{label}</span>
        <span className="text-zinc-500 transition group-open:rotate-180">⌄</span>
      </summary>
      <div className="absolute right-0 z-[300] mt-2 w-72 rounded border border-zinc-700/70 bg-[#090d13]/88 p-2 shadow-[0_22px_70px_rgba(0,0,0,0.62),0_0_34px_rgba(16,185,129,0.08)] backdrop-blur-md">
        {user !== null ? (
          <ApiKeysDialog />
        ) : null}
        {canSignOut ? (
          <form action={signOut} className="mt-2 border-t border-zinc-800/80 pt-2">
            <button className="flex w-full items-center justify-between rounded border border-red-500/20 bg-red-500/10 px-2.5 py-2.5 text-left text-sm text-red-100 transition hover:border-red-400/50 hover:bg-red-500/15" type="submit">
              <span>Sign out</span>
              <SignOutIcon />
            </button>
          </form>
        ) : (
          <form action={signIn} className="grid gap-3 pt-3">
            <input name="returnTo" type="hidden" value={returnTo} />
            <label className="grid gap-1.5">
              <span className="font-mono text-xs uppercase tracking-wide text-zinc-500">Username</span>
              <input
                autoComplete="username"
                className="rounded border border-zinc-800 bg-[#101621] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                name="username"
                required
                type="text"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-mono text-xs uppercase tracking-wide text-zinc-500">Password</span>
              <input
                autoComplete="current-password"
                className="rounded border border-zinc-800 bg-[#101621] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                name="password"
                required
                type="password"
              />
            </label>
            {loginError ? (
              <p className="rounded border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs text-red-100" role="alert">
                {loginError}
              </p>
            ) : null}
            <button className="rounded border border-emerald-400/60 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-400/10" type="submit">
              Sign in
            </button>
          </form>
        )}
      </div>
    </OutsideCloseDetails>
  );
}

function SignOutIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="m10 17 5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  );
}

function accountLabel(user: CurrentUser | null) {
  if (user?.displayName) {
    return user.displayName;
  }
  if (user?.email) {
    return usernameFromAuthEmail(user.email);
  }
  return "login";
}

function usernameFromAuthEmail(email: string) {
  return email.endsWith("@quadratics.xyz") ? email.slice(0, -"@quadratics.xyz".length) : email.split("@")[0];
}

function Logo() {
  return (
    <div className="flex items-center font-mono text-lg tracking-normal sm:text-xl" aria-label="quadratics.xyz">
      <span className="text-zinc-100">quadratics</span>
      <span className="relative ml-0.5 inline-block w-[2ch] leading-none text-emerald-300">
        <span>.</span>
        <span>x</span>
        <span className="absolute -top-[0.75em] left-0">y</span>
        <span className="absolute -top-[0.75em] left-[1ch]">z</span>
      </span>
    </div>
  );
}

function GithubIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49v-1.73c-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .08 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.86.09-.67.35-1.12.63-1.38-2.22-.26-4.55-1.14-4.55-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 7c.85 0 1.7.12 2.5.34 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.05.36.32.68.94.68 1.9v2.81c0 .27.18.59.69.49A10.1 10.1 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}
