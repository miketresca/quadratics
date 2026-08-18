import {signIn, signUpForLocalTesting} from "@/app/auth/actions";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{error?: string}>;
}) {
  const params = await searchParams;
  const message =
    params.error === "invalid_credentials"
      ? "Email or password was not accepted."
      : params.error === "signup_failed"
        ? "Could not create the local test account."
        : null;

  return (
    <main className="min-h-screen bg-[#07090d] text-zinc-100">
      <header className="fixed left-0 top-0 z-10 w-full px-5 py-5 sm:px-8">
        <div className="font-mono text-lg tracking-normal text-zinc-200">quadratics.xyz</div>
      </header>
      <form
        className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 px-6"
        action={signIn}
      >
        <label className="grid gap-2">
          <span className="text-sm font-medium text-zinc-300">Email</span>
          <input
            className="rounded border border-zinc-700 bg-[#101621] px-3 py-3 text-zinc-100 outline-none focus:border-emerald-400"
            name="email"
            type="email"
            required
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-zinc-300">Password</span>
          <input
            className="rounded border border-zinc-700 bg-[#101621] px-3 py-3 text-zinc-100 outline-none focus:border-emerald-400"
            name="password"
            type="password"
            required
          />
        </label>
        {message ? (
          <p className="text-sm text-red-300" role="alert">
            {message}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button className="rounded bg-emerald-500 px-4 py-2 font-medium text-zinc-950" type="submit">
            Sign in
          </button>
          <button
            className="rounded border border-zinc-700 px-4 py-2 font-medium text-zinc-300 hover:border-zinc-500 hover:text-white"
            formAction={signUpForLocalTesting}
          >
            Create test account
          </button>
        </div>
      </form>
    </main>
  );
}
