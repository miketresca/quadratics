import {redirect} from "next/navigation";

import {signOut} from "@/app/auth/actions";
import {EquationForm} from "@/components/equation-form";
import {getMe} from "@/lib/api";
import {createClient} from "@/lib/supabase/server";

export default async function AppPage() {
  const supabase = await createClient();
  const {
    data: {session}
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    redirect("/login");
  }

  const user = await getMe(session.access_token).catch(() => null);

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-6 sm:px-6">
      <form action={signOut} className="mb-6 flex justify-end">
        <button className="rounded border border-neutral-500 px-3 py-2 text-sm">Sign out</button>
      </form>
      <EquationForm initialUser={user} />
    </main>
  );
}
