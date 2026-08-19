import type {CurrentUser} from "@quadratics/types";

import {signIn, signOut} from "@/app/auth/actions";
import {AppModeShell} from "@/components/app-mode-shell";
import {ApiKeysDialog} from "@/components/api-keys-dialog";
import {OutsideCloseDetails} from "@/components/outside-close-details";
import {getMe} from "@/lib/api";
import {createClient} from "@/lib/supabase/server";

const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

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

  return (
    <main className="min-h-screen bg-[#07090d] text-zinc-100">
      <header className="fixed left-0 top-0 z-10 flex w-full items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <div className="flex items-center gap-2">
          <a
            aria-label="Open quadratics GitHub repository"
            className="flex h-10 w-10 items-center justify-center rounded border border-zinc-800 bg-zinc-950/40 text-zinc-300 hover:border-emerald-400/70 hover:text-emerald-300"
            href="https://github.com/miketresca/quadratics"
            rel="noreferrer"
            target="_blank"
          >
            <GithubIcon />
          </a>
          <AccountMenu loginError={loginError} user={user} />
        </div>
      </header>
      <AppModeShell initialUser={user} />
    </main>
  );
}

function AccountMenu({
  loginError,
  user
}: {
  loginError: string | null;
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
      <div className="absolute right-0 mt-2 w-72 rounded border border-zinc-800 bg-[#090d13] p-2 shadow-2xl shadow-black/50">
        <div className="border-b border-zinc-800 px-2 pb-2">
          <div className="truncate text-sm text-zinc-100">{label}</div>
          <div className="truncate text-xs text-zinc-500">
            {user ? "authenticated session" : "Authentication required to submit"}
          </div>
        </div>
        {user !== null ? (
          <ApiKeysDialog />
        ) : null}
        {canSignOut ? (
          <form action={signOut} className="mt-2 border-t border-zinc-800 pt-2">
            <button className="w-full rounded px-2 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-900" type="submit">
              Sign out
            </button>
          </form>
        ) : (
          <form action={signIn} className="grid gap-3 pt-3">
            <label className="grid gap-1.5">
              <span className="font-mono text-xs uppercase tracking-wide text-zinc-500">Username</span>
              <input
                autoComplete="username"
                className="rounded border border-zinc-800 bg-[#101621] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                name="username"
                placeholder="username"
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
