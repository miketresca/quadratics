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
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
      <h1 className="text-3xl font-semibold">Quadratics</h1>
      <form className="mt-8 grid gap-4" action={signIn}>
        <label className="grid gap-2">
          <span className="text-sm font-medium">Email</span>
          <input className="rounded border border-neutral-400 bg-white px-3 py-2" name="email" type="email" required />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium">Password</span>
          <input className="rounded border border-neutral-400 bg-white px-3 py-2" name="password" type="password" required />
        </label>
        {message ? <p className="text-sm text-red-700" role="alert">{message}</p> : null}
        <div className="flex flex-wrap gap-3">
          <button className="rounded bg-emerald-700 px-4 py-2 font-medium text-white" type="submit">
            Sign in
          </button>
          <button className="rounded border border-neutral-500 px-4 py-2 font-medium" formAction={signUpForLocalTesting}>
            Create test account
          </button>
        </div>
      </form>
    </main>
  );
}
