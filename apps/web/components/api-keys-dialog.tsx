"use client";

import type {ProviderKeyMetadata} from "@quadratics/types";
import {useState, useTransition} from "react";

import {deleteProviderKey, listProviderKeys, saveProviderKey} from "@/lib/api";
import {createClient} from "@/lib/supabase/client";

const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function ApiKeysDialog() {
  const [open, setOpen] = useState(false);
  const [heygenKey, setHeygenKey] = useState("");
  const [metadata, setMetadata] = useState<ProviderKeyMetadata | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openDialog() {
    setOpen(true);
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const accessToken = await getAccessToken();
        const response = await listProviderKeys(accessToken);
        setMetadata(response.keys.find((key) => key.provider === "heygen") ?? null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load API keys");
      }
    });
  }

  function saveKey() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const accessToken = await getAccessToken();
        const saved = await saveProviderKey({
          accessToken,
          provider: "heygen",
          apiKey: heygenKey
        });
        setMetadata(saved);
        setHeygenKey("");
        setMessage("HeyGen key saved.");
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Could not save HeyGen key");
      }
    });
  }

  function deleteKey() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const accessToken = await getAccessToken();
        await deleteProviderKey({accessToken, provider: "heygen"});
        setMetadata(null);
        setHeygenKey("");
        setMessage("HeyGen key removed.");
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Could not delete HeyGen key");
      }
    });
  }

  return (
    <>
      <button
        className="w-full rounded px-2 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-900 hover:text-emerald-300"
        onClick={openDialog}
        type="button"
      >
        API keys
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 bg-black/50 px-4 py-20 backdrop-blur-sm" role="presentation">
          <section
            aria-modal="true"
            className="ml-auto w-full max-w-xl rounded-md border border-zinc-800 bg-[#090d13] p-4 shadow-2xl shadow-black/70"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-3">
              <div>
                <h2 className="font-mono text-sm uppercase tracking-wide text-zinc-100">api_keys</h2>
                <p className="mt-1 text-sm text-zinc-500">HeyGen credentials for AI avatar generation.</p>
              </div>
              <button
                aria-label="Close API keys"
                className="rounded border border-zinc-800 px-2 py-1 text-zinc-500 hover:border-emerald-400/60 hover:text-emerald-300"
                onClick={() => setOpen(false)}
                type="button"
              >
                x
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-2 rounded border border-zinc-800 bg-zinc-950/45 p-3">
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-zinc-100">HeyGen</span>
                  <span className="font-mono text-xs text-zinc-500">HEYGEN_API_KEY</span>
                </span>
                <input
                  autoComplete="off"
                  className="rounded border border-zinc-800 bg-[#101621] px-3 py-2 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-600"
                  onChange={(event) => setHeygenKey(event.target.value)}
                  placeholder={metadata ? `saved ${metadata.keyHint}` : "heygen_..."}
                  type="password"
                  value={heygenKey}
                />
                <span className="font-mono text-xs text-zinc-500">
                  {metadata ? `stored: ${metadata.keyHint}` : "no key stored"}
                </span>
              </label>
            </div>

            {message ? (
              <p className="mt-4 rounded border border-emerald-400/30 bg-emerald-950/20 p-3 text-sm text-emerald-100">
                {message}
              </p>
            ) : null}
            {error ? (
              <p className="mt-4 rounded border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-100" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded border border-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
                onClick={() => setOpen(false)}
                type="button"
              >
                Close
              </button>
              <button
                className="rounded border border-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:border-red-500/50 hover:text-red-200 disabled:cursor-not-allowed disabled:text-zinc-600"
                disabled={isPending || metadata === null}
                onClick={deleteKey}
                type="button"
              >
                Delete
              </button>
              <button
                className="rounded border border-emerald-400/60 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-600"
                disabled={isPending || heygenKey.trim().length === 0}
                onClick={saveKey}
                type="button"
              >
                {isPending ? "Saving..." : "Save key"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

async function getAccessToken() {
  if (!supabaseConfigured) {
    throw new Error("Sign in to manage API keys.");
  }
  const supabase = createClient();
  const {
    data: {session}
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Sign in to manage API keys.");
  }
  return session.access_token;
}
