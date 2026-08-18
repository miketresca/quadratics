"use client";

import {useState} from "react";

const providerKeys = [
  {
    name: "ElevenLabs",
    envName: "ELEVENLABS_API_KEY",
    placeholder: "sk_..."
  },
  {
    name: "HeyGen",
    envName: "HEYGEN_API_KEY",
    placeholder: "heygen_..."
  }
];

export function ApiKeysDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="w-full rounded px-2 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-900 hover:text-emerald-300"
        onClick={() => setOpen(true)}
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
                <p className="mt-1 text-sm text-zinc-500">Provider credentials for future audio and avatar generation.</p>
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
              {providerKeys.map((provider) => (
                <label
                  className="grid gap-2 rounded border border-zinc-800 bg-zinc-950/45 p-3"
                  key={provider.envName}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-zinc-100">{provider.name}</span>
                    <span className="font-mono text-xs text-zinc-500">{provider.envName}</span>
                  </span>
                  <input
                    autoComplete="off"
                    className="rounded border border-zinc-800 bg-[#101621] px-3 py-2 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-600"
                    name={provider.envName}
                    placeholder={provider.placeholder}
                    type="password"
                  />
                </label>
              ))}
            </div>

            <div className="mt-4 rounded border border-amber-500/25 bg-amber-950/20 p-3 text-sm leading-6 text-amber-100">
              This form is not connected to storage yet. For production use today, set these keys as Railway environment
              variables on the API service.
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded border border-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
                onClick={() => setOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="cursor-not-allowed rounded border border-zinc-800 px-3 py-2 text-sm text-zinc-500"
                disabled
                type="button"
              >
                Save keys
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
