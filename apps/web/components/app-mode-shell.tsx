"use client";

import type {CurrentUser} from "@quadratics/types";
import {useState} from "react";

import {EquationForm} from "@/components/equation-form";

type AppMode = "app" | "notes";

export function AppModeShell({
  initialUser,
  readmeMarkdown
}: {
  initialUser: CurrentUser | null;
  readmeMarkdown: string;
}) {
  const [mode, setMode] = useState<AppMode>("app");

  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
      <div className="mb-7 flex justify-center">
        <div className="grid w-56 grid-cols-2 rounded-full border border-zinc-800 bg-zinc-950/70 p-1 text-sm shadow-xl shadow-black/30">
          <button
            aria-pressed={mode === "app"}
            className={modeButtonClass(mode === "app")}
            onClick={() => setMode("app")}
            type="button"
          >
            App
          </button>
          <button
            aria-pressed={mode === "notes"}
            className={modeButtonClass(mode === "notes")}
            onClick={() => setMode("notes")}
            type="button"
          >
            Notes
          </button>
        </div>
      </div>

      {mode === "app" ? <EquationForm initialUser={initialUser} /> : <NotesMode readmeMarkdown={readmeMarkdown} />}
    </div>
  );
}

function NotesMode({readmeMarkdown}: {readmeMarkdown: string}) {
  return (
    <section className="mx-auto grid max-w-5xl gap-6" aria-label="Notes">
      <div
        aria-label="Loom video embed placeholder"
        className="group relative aspect-video overflow-hidden rounded-md border border-zinc-800 bg-[#080c12] shadow-2xl shadow-black/40"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(52,211,153,0.12),transparent_34%),linear-gradient(180deg,rgba(24,32,43,0.76),rgba(7,9,13,0.94))]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.026)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.026)_1px,transparent_1px)] bg-[size:56px_56px]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-300/35 bg-zinc-950/70 shadow-[0_0_40px_rgba(52,211,153,0.18)] transition group-hover:border-emerald-300/70 group-hover:shadow-[0_0_52px_rgba(52,211,153,0.28)] sm:h-20 sm:w-20">
            <span className="ml-1 block h-0 w-0 border-y-[12px] border-l-[18px] border-y-transparent border-l-emerald-200 sm:border-y-[15px] sm:border-l-[24px]" />
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-zinc-800 bg-zinc-950/60 shadow-2xl shadow-black/25">
        <div className="flex h-10 items-center gap-2 border-b border-zinc-800 bg-[#080c12] px-4" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/70" />
        </div>
        <pre className="max-h-[42rem] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-6 text-zinc-300 sm:p-6 sm:text-sm">
          {readmeMarkdown}
        </pre>
      </div>
    </section>
  );
}

function modeButtonClass(active: boolean) {
  return [
    "h-9 rounded-full px-4 transition",
    active ? "bg-emerald-400 text-emerald-950" : "text-zinc-400 hover:text-zinc-100"
  ].join(" ");
}
