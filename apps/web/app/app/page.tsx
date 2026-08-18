import {redirect} from "next/navigation";

import {signOut} from "@/app/auth/actions";
import {EquationForm} from "@/components/equation-form";
import {getMe} from "@/lib/api";
import {devAuthBypass} from "@/lib/env";
import {createClient} from "@/lib/supabase/server";

export default async function AppPage() {
  const accessToken = devAuthBypass ? "dev" : null;
  let sessionToken = accessToken;

  if (!devAuthBypass) {
    const supabase = await createClient();
    const {
      data: {session}
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      redirect("/login");
    }

    sessionToken = session.access_token;
  }

  const user =
    sessionToken !== null
      ? await getMe(sessionToken).catch(() => ({
          id: "00000000-0000-0000-0000-000000000001",
          email: "dev@example.com",
          displayName: null,
          creditBalance: 0
        }))
      : null;

  return (
    <main className="min-h-screen bg-[#07090d] text-zinc-100">
      <header className="fixed left-0 top-0 z-10 flex w-full items-center justify-between px-5 py-5 sm:px-8">
        <div className="font-mono text-lg tracking-normal text-zinc-200">quadratics.xyz</div>
        {devAuthBypass ? (
          <div className="rounded border border-emerald-500/40 bg-emerald-950/20 px-3 py-2 font-mono text-xs text-emerald-300">
            dev_auth
          </div>
        ) : (
          <form action={signOut}>
            <button className="rounded border border-zinc-700/80 bg-zinc-950/30 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-500 hover:text-white">
              Sign out
            </button>
          </form>
        )}
      </header>
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-4 py-24 sm:px-6">
        <EquationForm initialUser={user} />
      </div>
    </main>
  );
}
