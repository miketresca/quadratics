"use client";

import type {ProviderKeyMetadata} from "@quadratics/types";
import {useState, useTransition} from "react";

import {deleteProviderKey, listProviderKeys, saveProviderKey} from "@/lib/api";
import {createClient} from "@/lib/supabase/client";

const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function ApiKeysDialog() {
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [heygenKey, setHeygenKey] = useState("");
  const [metadata, setMetadata] = useState<ProviderKeyMetadata | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const dirty = heygenKey.trim().length > 0;

  function toggleExpanded() {
    setMessage(null);
    setError(null);
    const next = !expanded;
    setExpanded(next);
    if (next && !loaded) {
      loadKeys();
    }
  }

  function closePanel() {
    setExpanded(false);
    setHeygenKey("");
    setMessage(null);
    setError(null);
  }

  function loadKeys() {
    startTransition(async () => {
      try {
        const accessToken = await getAccessToken();
        const response = await listProviderKeys(accessToken);
        setMetadata(response.keys.find((key) => key.provider === "heygen") ?? null);
        setLoaded(true);
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
        setLoaded(true);
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
        setLoaded(true);
        setMessage("HeyGen key removed.");
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Could not delete HeyGen key");
      }
    });
  }

  return (
    <div className="rounded border border-zinc-800/80 bg-zinc-950/30">
      <button
        aria-expanded={expanded}
        className="flex h-12 w-full items-center justify-between px-3 text-sm text-zinc-200 transition hover:text-emerald-200"
        onClick={toggleExpanded}
        type="button"
      >
        <span className="flex min-w-0 flex-col items-start">
          <span className="leading-none">API keys</span>
        </span>
        <ChevronIcon open={expanded} />
      </button>
      {expanded ? (
        <div className="grid gap-3 border-t border-zinc-800/80 p-3">
          <label className="grid gap-1.5">
            <span className="flex items-center justify-between gap-3">
              <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">HeyGen</span>
              <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-600">
                {metadata ? `stored ${metadata.keyHint}` : "no key stored"}
              </span>
            </span>
            <input
              autoComplete="off"
              className="h-10 rounded border border-zinc-800 bg-black/30 px-3 font-mono text-xs text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-emerald-400/70"
              onChange={(event) => {
                setMessage(null);
                setError(null);
                setHeygenKey(event.currentTarget.value);
              }}
              placeholder="heygen_..."
              type="password"
              value={heygenKey}
            />
          </label>

          {message ? (
            <p className="font-mono text-[11px] uppercase tracking-wide text-emerald-300">{message}</p>
          ) : null}
          {error ? (
            <p className="rounded border border-red-500/35 bg-red-500/10 px-2.5 py-2 text-xs text-red-100" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            {metadata ? (
              <button
                className="mr-auto rounded border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-200 transition hover:border-red-400/60 hover:bg-red-500/15 disabled:opacity-50"
                disabled={isPending}
                onClick={deleteKey}
                type="button"
              >
                Delete
              </button>
            ) : null}
            <button
              className="rounded border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-100"
              onClick={closePanel}
              type="button"
            >
              Close
            </button>
            {dirty ? (
              <button
                className="rounded border border-emerald-400/50 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-50"
                disabled={isPending}
                onClick={saveKey}
                type="button"
              >
                {isPending ? "Saving" : "Save"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChevronIcon({open}: {open: boolean}) {
  return (
    <svg
      aria-hidden="true"
      className={`h-4 w-4 text-zinc-500 transition ${open ? "rotate-180 text-emerald-300" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
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
