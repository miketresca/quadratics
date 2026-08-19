"use client";

import type {CurrentUser} from "@quadratics/types";
import type {ReactNode} from "react";
import {useState} from "react";

import {EquationForm} from "@/components/equation-form";

type AppMode = "app" | "notes";

const notes = [
  {
    id: "overview",
    label: "Overview",
    title: "A quadratic homework problem becomes a short guided lesson.",
    kicker: "starting point",
    body: "The app is a focused demo for generating walkthroughs of quadratic equation homework problems. A student enters an equation, chooses an instructor, and the system builds the pieces needed for a 30-90 second explanation."
  },
  {
    id: "source-material",
    label: "Source Material",
    title: "The rough thinking stays visible.",
    kicker: "workbench",
    body: "The finished app is intentionally simple, but the path to it was not. This section is for the artifacts that show where my head was at: a walkthrough video, planning markdown, and the embedded pipeline map below."
  },
  {
    id: "limits",
    label: "Limits",
    title: "The current limit is clean factoring.",
    kicker: "product boundary",
    body: "Right now the teaching experience is intentionally limited to quadratic equations that factor cleanly. The API can recognize valid quadratics outside that path, but the lesson builder should be honest when another method is required."
  },
  {
    id: "tradeoffs",
    label: "Tradeoffs",
    title: "The demo optimizes for a believable pipeline, not broad math coverage.",
    kicker: "why this first",
    body: "Trying to support every algebra problem would make the demo about general math tutoring. Narrowing the domain lets the product show the harder system problem: deterministic math, reusable teaching structure, provider boundaries, and media generation costs."
  },
  {
    id: "architecture",
    label: "Architecture",
    title: "The architecture separates truth, explanation, and media.",
    kicker: "system shape",
    body: "The LLM never decides the math. The service builds a deterministic lesson first, then script, narration, board animation, and optional avatar generation can attach to stable teaching-step and math-line IDs."
  },
  {
    id: "next",
    label: "Next",
    title: "The next work keeps pushing toward video.",
    kicker: "roadmap",
    body: "The near-term path is to polish the generated video experience, then expand the supported solving methods without weakening the math contract."
  }
];

const limitRows = [
  {
    label: "Works today",
    value: "Quadratics that factor cleanly over rational values."
  },
  {
    label: "Recognized but limited",
    value: "Valid quadratics that need square root, completing the square, or quadratic formula paths."
  },
  {
    label: "Not in scope",
    value: "A general algebra tutor or a solver for every textbook exercise."
  }
];

const tradeoffs = [
  {
    choice: "Quadratics only",
    insteadOf: "All algebra problems",
    reason: "A narrow domain makes the pipeline testable enough for a short-term demo."
  },
  {
    choice: "Motion Canvas board animation",
    insteadOf: "Generative video for the whole scene",
    reason: "The math on the board needs exact timing, repeatability, and clean rendering."
  },
  {
    choice: "Segment-level narration",
    insteadOf: "One long audio file",
    reason: "Retries and future caching can happen one teaching step at a time."
  },
  {
    choice: "Provider adapters",
    insteadOf: "Hard-coding one vendor",
    reason: "OpenAI, ElevenLabs, HeyGen, and future video providers can change independently."
  }
];

const pipelinePhases = [
  {
    phase: "01",
    title: "User input",
    body: "The app collects the problem and generation preferences before any provider work can run.",
    steps: ["Enter quadratic equation", "Select instructor", "Choose lesson output mode"],
    decision: {
      label: "Is this a valid quadratic?",
      yes: "Normalize and solve",
      no: "Return validation error and loop back to input",
      status: "live"
    }
  },
  {
    phase: "02",
    title: "Equation processing",
    body: "All mathematical truth is established before scripts, audio, or video enter the pipeline.",
    steps: ["Normalize equation", "Choose solving method", "Solve with SymPy", "Generate deterministic transformations"],
    decision: {
      label: "Can v0 teach this method?",
      yes: "Build factoring lesson",
      no: "Return unsupported-method state",
      status: "live"
    }
  },
  {
    phase: "03",
    title: "Lesson construction",
    body: "The lesson is the shared contract between the API, web logs, narration, and the video renderer.",
    steps: ["Group math lines into teaching steps", "Create lesson JSON", "Generate constrained teacher script", "Reference step and math-line IDs"],
    decision: {
      label: "Generate narration now?",
      yes: "Prepare speech markup and audio segments",
      no: "Keep deterministic lesson and script logs inspectable",
      status: "live"
    }
  },
  {
    phase: "04",
    title: "Narration and media",
    body: "The current build keeps audio reusable while Motion Canvas renders the deterministic blackboard scene.",
    steps: ["Convert script to spoken math", "Generate ElevenLabs segment audio", "Keep timing metadata per step", "Render Motion Canvas board animation"],
    decision: {
      label: "Avatar video available?",
      yes: "Composite optional avatar with board animation",
      no: "Render board plus narration only",
      status: "live"
    }
  },
  {
    phase: "05",
    title: "Output and reuse",
    body: "The final asset is user-owned, auditable, and increasingly cacheable by normalized lesson inputs.",
    steps: ["Render each teaching segment", "Combine step videos", "Store generated lesson artifacts", "Generate cache identity"],
    decision: {
      label: "Cached generation exists?",
      yes: "Reuse matching assets",
      no: "Run only the missing pipeline step",
      status: "live"
    }
  }
];

const artifacts = [
  {
    title: "Planning markdown",
    body: "A compact version of the original brainstorm can live here, or this slot can link out to the full markdown once it gets cleaned up.",
    accent: "emerald"
  },
  {
    title: "Pipeline map",
    body: "The architecture diagram is native UI on this page, so the case study does not depend on a separate Miro embed.",
    accent: "sky"
  },
  {
    title: "Implementation notes",
    body: "A small place for the parts that changed after the original plan, especially where the docs are useful but not fully current.",
    accent: "amber"
  }
];

const nextMoves = [
  "Polish the generated video experience around captions, highlights, and final-answer emphasis.",
  "Expand teaching support beyond clean factoring while keeping deterministic verification.",
  "Add optional avatar composition around the finished blackboard video."
];

export function AppModeShell({initialUser}: {initialUser: CurrentUser | null}) {
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

      {mode === "app" ? <EquationForm initialUser={initialUser} /> : <NotesMode />}
    </div>
  );
}

function NotesMode() {
  return (
    <section className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_15rem]" aria-labelledby="engineering-notes-title">
      <div className="min-w-0">
        <div className="border-b border-zinc-800 pb-8">
          <p className="font-mono text-xs uppercase tracking-wide text-emerald-300">engineering notes</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-normal text-zinc-100 sm:text-4xl" id="engineering-notes-title">
            From quadratic equation to generated lesson.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-300">
            A short case-study page for the product thinking behind this app: why the scope is narrow, where the media pipeline is headed, and which technical decisions make the system trustworthy.
          </p>
        </div>

        <nav className="mt-6 rounded-md border border-zinc-800 bg-zinc-950/35 p-3 lg:hidden" aria-label="Notes contents">
          <p className="font-mono text-xs uppercase tracking-wide text-zinc-500">on this build</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {notes.map((note) => (
              <a className="rounded-md border border-zinc-800 px-3 py-2 text-sm text-zinc-300" href={`#${note.id}`} key={note.id}>
                {note.label}
              </a>
            ))}
          </div>
        </nav>

        <div className="mt-8 grid gap-8">
          <MediaSlot id="overview" label="loom slot" title="Walkthrough video" tone="emerald">
            Embed the Loom walkthrough here. The goal is a quick orientation before someone reads the details: what the app does, what is real today, and what the pipeline is building toward.
          </MediaSlot>

          <NoteSection note={notes[1]}>
            <div className="grid gap-3">
              {artifacts.map((artifact) => (
                <ArtifactSlot artifact={artifact} key={artifact.title} />
              ))}
            </div>
          </NoteSection>

          <NoteSection note={notes[2]}>
            <div className="grid gap-3">
              {limitRows.map((row) => (
                <div className="rounded-md border border-zinc-800 bg-zinc-950/35 p-4" key={row.label}>
                  <p className="font-mono text-xs uppercase tracking-wide text-zinc-500">{row.label}</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">{row.value}</p>
                </div>
              ))}
            </div>
          </NoteSection>

          <NoteSection note={notes[3]}>
            <div className="grid gap-3">
              {tradeoffs.map((tradeoff) => (
                <article className="rounded-md border border-zinc-800 bg-zinc-950/35 p-4" key={tradeoff.choice}>
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                    <p className="text-sm font-semibold text-emerald-200">{tradeoff.choice}</p>
                    <span className="hidden font-mono text-xs uppercase tracking-wide text-zinc-600 sm:block">over</span>
                    <p className="text-sm text-zinc-400">{tradeoff.insteadOf}</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-300">{tradeoff.reason}</p>
                </article>
              ))}
            </div>
          </NoteSection>

          <NoteSection note={notes[4]}>
            <PipelineMap />
          </NoteSection>

          <section className="scroll-mt-28 grid gap-4 border-t border-zinc-800 pt-8" id={notes[5].id} aria-labelledby="next-build-title">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-wide text-fuchsia-300">{notes[5].kicker}</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-normal text-zinc-100" id="next-build-title">
                  {notes[5].title}
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">{notes[5].body}</p>
              </div>
              <a
                className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-700 px-3 text-sm text-zinc-200 transition hover:border-fuchsia-300/70 hover:bg-fuchsia-400/10 hover:text-fuchsia-100"
                href="https://github.com/miketresca/quadratics"
                rel="noreferrer"
                target="_blank"
              >
                View source
              </a>
            </div>
            <ol className="grid gap-3 text-sm leading-6 text-zinc-300">
              {nextMoves.map((move, index) => (
                <li className="flex gap-3 border-l border-zinc-800 pl-3" key={move}>
                  <span className="font-mono text-zinc-500">{String(index + 1).padStart(2, "0")}</span>
                  <span>{move}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      <aside className="hidden lg:block" aria-label="Notes contents">
        <div className="sticky top-28 border-l border-zinc-800 pl-5">
          <p className="font-mono text-xs uppercase tracking-wide text-zinc-500">on this build</p>
          <nav className="mt-5 grid gap-3 text-sm">
            {notes.map((note) => (
              <a className="text-zinc-400 transition hover:text-emerald-300" href={`#${note.id}`} key={note.id}>
                {note.label}
              </a>
            ))}
          </nav>
        </div>
      </aside>
    </section>
  );
}

function NoteSection({
  children,
  note
}: {
  children: ReactNode;
  note: (typeof notes)[number];
}) {
  return (
    <section className="scroll-mt-28 grid gap-4 border-t border-zinc-800 pt-8" id={note.id} aria-labelledby={`${note.id}-title`}>
      <div>
        <p className="font-mono text-xs uppercase tracking-wide text-sky-300">{note.kicker}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-normal text-zinc-100" id={`${note.id}-title`}>
          {note.title}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">{note.body}</p>
      </div>
      {children}
    </section>
  );
}

function MediaSlot({
  children,
  id,
  label,
  title,
  tone
}: {
  children: ReactNode;
  id: string;
  label: string;
  title: string;
  tone: "emerald" | "sky";
}) {
  const toneClass = tone === "emerald" ? "border-emerald-400/30 text-emerald-300" : "border-sky-400/30 text-sky-300";

  return (
    <section className="scroll-mt-28 grid gap-4 border-t border-zinc-800 pt-8" id={id} aria-labelledby={`${id}-title`}>
      <div>
        <p className={`font-mono text-xs uppercase tracking-wide ${tone === "emerald" ? "text-emerald-300" : "text-sky-300"}`}>
          {label}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-normal text-zinc-100" id={`${id}-title`}>
          {title}
        </h2>
      </div>
      <div className={`aspect-video rounded-md border ${toneClass} bg-zinc-950/45 p-4`}>
        <div className="flex h-full items-center justify-center rounded border border-dashed border-zinc-700 bg-[#080c12]/80 p-6 text-center text-sm leading-6 text-zinc-400">
          {children}
        </div>
      </div>
    </section>
  );
}

function PipelineMap() {
  return (
    <div className="overflow-hidden rounded-md border border-zinc-800 bg-zinc-950/35">
      <div className="border-b border-zinc-800 bg-[#080c12]/80 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-zinc-500">current pipeline</p>
            <h3 className="mt-1 text-base font-semibold text-zinc-100">From problem input to synchronized lesson media</h3>
          </div>
          <span className="w-fit rounded border border-emerald-400/30 px-2 py-1 font-mono text-xs uppercase tracking-wide text-emerald-300">
            deterministic core
          </span>
        </div>
      </div>

      <div className="grid gap-3 p-4">
        {pipelinePhases.map((phase, index) => (
          <PipelinePhase index={index} key={phase.phase} phase={phase} />
        ))}
      </div>

      <div className="border-t border-zinc-800 bg-[#080c12]/55 p-4">
        <p className="text-sm leading-6 text-zinc-400">
          The early idea was to generate unique video for every solution step. The current direction is lighter: deterministic lesson construction, segment-level audio, Motion Canvas board animation, and optional avatar composition around a stable lesson contract.
        </p>
      </div>
    </div>
  );
}

function PipelinePhase({
  index,
  phase
}: {
  index: number;
  phase: (typeof pipelinePhases)[number];
}) {
  return (
    <section className="relative grid gap-3 rounded-md border border-zinc-800 bg-[#080c12]/80 p-3 sm:p-4" aria-label={phase.title}>
      {index > 0 ? <div className="absolute -top-3 left-7 h-3 border-l border-dashed border-zinc-700" aria-hidden="true" /> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-emerald-400/30 bg-emerald-400/10 font-mono text-xs text-emerald-300">
            {phase.phase}
          </span>
          <div>
            <h4 className="text-base font-semibold text-zinc-100">{phase.title}</h4>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">{phase.body}</p>
          </div>
        </div>
        <StatusPill status={phase.decision.status} />
      </div>

      <p className="rounded border border-sky-400/20 bg-sky-950/10 px-3 py-2 text-xs leading-5 text-sky-100 sm:hidden">
        <span className="font-mono uppercase text-sky-300">decision</span> {phase.decision.label}
      </p>

      <div className="hidden gap-3 sm:grid lg:grid-cols-[minmax(0,1fr)_18rem]">
        <ol className="flex flex-wrap gap-2">
          {phase.steps.map((step, stepIndex) => (
            <li className="inline-flex items-center gap-2 rounded border border-zinc-800 bg-zinc-950/45 px-2.5 py-2 text-sm leading-5 text-zinc-200" key={step}>
              <span className="font-mono text-xs text-zinc-600">{String(stepIndex + 1).padStart(2, "0")}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <DecisionCard decision={phase.decision} />
      </div>
    </section>
  );
}

function DecisionCard({decision}: {decision: (typeof pipelinePhases)[number]["decision"]}) {
  return (
    <aside className="rounded border border-sky-400/25 bg-sky-950/10 p-3">
      <p className="font-mono text-xs uppercase tracking-wide text-sky-300">decision</p>
      <h5 className="mt-2 text-sm font-semibold text-zinc-100">{decision.label}</h5>
      <div className="mt-3 grid gap-2 text-xs leading-5 sm:grid-cols-2 lg:grid-cols-1">
        <p className="rounded border border-emerald-400/20 bg-emerald-950/15 px-2 py-1.5 text-emerald-100">
          <span className="font-mono uppercase text-emerald-300">yes</span> {decision.yes}
        </p>
        <p className="rounded border border-amber-400/20 bg-amber-950/15 px-2 py-1.5 text-amber-100">
          <span className="font-mono uppercase text-amber-300">no</span> {decision.no}
        </p>
      </div>
    </aside>
  );
}

function StatusPill({status}: {status: string}) {
  if (status === "live") {
    return (
      <span className="w-fit rounded border border-emerald-400/25 px-2 py-1 font-mono text-xs uppercase tracking-wide text-emerald-300">
        live
      </span>
    );
  }
  return (
    <span className="w-fit rounded border border-zinc-700 px-2 py-1 font-mono text-xs uppercase tracking-wide text-zinc-400">
      {status}
    </span>
  );
}

function ArtifactSlot({
  artifact
}: {
  artifact: {
    accent: string;
    body: string;
    title: string;
  };
}) {
  const accentClass =
    artifact.accent === "emerald"
      ? "text-emerald-300"
      : artifact.accent === "sky"
        ? "text-sky-300"
        : "text-amber-300";

  return (
    <article className="grid gap-3 rounded-md border border-zinc-800 bg-zinc-950/35 p-4 sm:grid-cols-[11rem_1fr]">
      <h3 className={`text-sm font-semibold ${accentClass}`}>{artifact.title}</h3>
      <p className="text-sm leading-6 text-zinc-300">{artifact.body}</p>
    </article>
  );
}

function modeButtonClass(active: boolean) {
  return [
    "h-9 rounded-full px-4 transition",
    active ? "bg-emerald-400 text-emerald-950" : "text-zinc-400 hover:text-zinc-100"
  ].join(" ");
}
