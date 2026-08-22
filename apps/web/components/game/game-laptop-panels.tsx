import type {CurrentUser} from "@quadratics/types";
import type {FormEvent} from "react";

import type {GameLessonArtifact, GameLessonStage, GameUsageEventItem, GameUsageSummary, GameWorksheetRunSnapshot} from "@/lib/api";

import {FocusedPipelinePanel} from "./game-pipeline-panel";
import {shortRunId} from "./game-pipeline-utils";

export type LaptopTab = "demo" | "pipeline" | "costs" | "music" | "settings";
export type MusicOptionId = "lofi" | "techno" | "classical";
export type MusicOption = {
  id: MusicOptionId;
  label: string;
  subtitle: string;
  videoId: string;
};
export type MusicState = {
  muted: boolean;
  selectedMusicId: MusicOptionId;
  volume: number;
};
export type LaptopPipelineState = {
  error: string | null;
  loading: boolean;
  loadingStage: GameLessonStage | null;
  run: GameWorksheetRunSnapshot | null;
};
export type LaptopCostState = {
  error: string | null;
  events: GameUsageEventItem[];
  loading: boolean;
  summary: GameUsageSummary | null;
};

export const MUSIC_OPTIONS: MusicOption[] = [
  {
    id: "lofi",
    label: "Lo-fi Girl",
    subtitle: "calm study radio",
    videoId: "0muHFBSiybw"
  },
  {
    id: "techno",
    label: "Techno Focus",
    subtitle: "high-energy deep work",
    videoId: "G-u5OhIeln4"
  },
  {
    id: "classical",
    label: "Classical",
    subtitle: "instrumental focus",
    videoId: "y6TZHLAzg5o"
  }
];

export function LaptopFocusPanel({
  costs,
  error,
  loading,
  musicMuted,
  musicVolume,
  onApproveArtifact,
  onCreateRun,
  onMusicChange,
  onMusicMutedChange,
  onMusicVolumeChange,
  onResetProgress,
  onRunStage,
  onSignIn,
  onSignOut,
  onTabChange,
  pipeline,
  selectedMusicId,
  tab,
  user
}: {
  costs: LaptopCostState;
  error: string | null;
  loading: boolean;
  musicMuted: boolean;
  musicVolume: number;
  onCreateRun: () => void;
  onMusicChange: (selectedMusicId: MusicOptionId) => void;
  onMusicMutedChange: (muted: boolean) => void;
  onMusicVolumeChange: (volume: number) => void;
  onResetProgress: () => void;
  onApproveArtifact: (artifact: GameLessonArtifact) => void;
  onRunStage: (stage: GameLessonStage, options?: {force?: boolean}) => void;
  onSignIn: (event: FormEvent<HTMLFormElement>) => void;
  onSignOut: () => void;
  onTabChange: (tab: LaptopTab) => void;
  pipeline: LaptopPipelineState;
  selectedMusicId: MusicOptionId;
  tab: LaptopTab;
  user: CurrentUser | null;
}) {
  return (
    <div className="pointer-events-auto h-full w-full rounded-[2rem] border border-cyan-100/20 bg-[#070b12] p-8 shadow-[0_0_80px_rgba(20,184,166,0.2)]">
      <div className="grid h-full overflow-hidden rounded-2xl border border-emerald-200/20 bg-[#080b12]">
        {!user ? (
          <form
            className="grid h-full place-items-center"
            onSubmit={onSignIn}
          >
            <div className="grid w-full max-w-md gap-4 rounded-2xl border border-emerald-200/20 bg-black/55 p-8 shadow-2xl shadow-emerald-950/20">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-zinc-50">quadratics login</h2>
                <p className="mt-2 text-sm text-zinc-400">Start a saved worksheet session.</p>
              </div>
              <label className="grid gap-2">
                <span className="text-[11px] uppercase tracking-widest text-zinc-500">Username</span>
                <input
                  autoComplete="username"
                  className="rounded-lg border border-zinc-700 bg-[#101621] px-3 py-3 text-base text-zinc-50 outline-none focus:border-emerald-300/80"
                  name="username"
                  required
                  type="text"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-[11px] uppercase tracking-widest text-zinc-500">Password</span>
                <input
                  autoComplete="current-password"
                  className="rounded-lg border border-zinc-700 bg-[#101621] px-3 py-3 text-base text-zinc-50 outline-none focus:border-emerald-300/80"
                  name="password"
                  required
                  type="password"
                />
              </label>
              {error ? (
                <div className="rounded-lg border border-red-400/45 bg-red-950/45 px-3 py-2 text-sm text-red-100">
                  {error}
                </div>
              ) : null}
              <button
                className="rounded-lg border border-emerald-300/70 bg-emerald-950/60 px-4 py-3 text-sm font-black uppercase tracking-widest text-emerald-100 hover:bg-emerald-900/60 disabled:cursor-wait disabled:opacity-60"
                disabled={loading}
                type="submit"
              >
                {loading ? "Signing in" : "Sign in"}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid h-full grid-rows-[4.2rem_1fr] bg-[#070b12]">
            <div className="flex items-end gap-2 border-b border-zinc-700/70 bg-[#111318] px-3 pt-2">
              {([
                ["demo", "Demo"],
                ["pipeline", "Pipeline"],
                ["costs", "Costs"],
                ["music", "Music"],
                ["settings", "Settings"]
              ] as Array<[LaptopTab, string]>).map(([value, label]) => (
                <button
                  className={`h-11 rounded-t-xl border px-6 text-base font-black ${tab === value ? "border-zinc-700 border-b-[#071018] bg-[#071018] text-emerald-200" : "border-zinc-700 bg-[#191b22] text-zinc-400 hover:text-zinc-100"}`}
                  data-testid={`focused-laptop-tab-${value}`}
                  key={value}
                  onClick={() => onTabChange(value)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="min-h-0 bg-gradient-to-br from-[#071018] to-[#090d14] p-5">
              {tab === "music" ? (
                <FocusedMusicPanel
                  musicMuted={musicMuted}
                  musicVolume={musicVolume}
                  onMusicChange={onMusicChange}
                  onMusicMutedChange={onMusicMutedChange}
                  onMusicVolumeChange={onMusicVolumeChange}
                  selectedMusicId={selectedMusicId}
                />
              ) : tab === "pipeline" ? (
                <FocusedPipelinePanel
                  onApproveArtifact={onApproveArtifact}
                  onCreateRun={onCreateRun}
                  onResetProgress={onResetProgress}
                  onRunStage={onRunStage}
                  pipeline={pipeline}
                />
              ) : tab === "costs" ? (
                <FocusedCostsPanel costs={costs} pipeline={pipeline} />
              ) : tab === "settings" ? (
                <FocusedSettingsPanel onSignOut={onSignOut} user={user} />
              ) : (
                <FocusedDemoPanel />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FocusedMusicPanel({
  musicMuted,
  musicVolume,
  onMusicChange,
  onMusicMutedChange,
  onMusicVolumeChange,
  selectedMusicId
}: {
  musicMuted: boolean;
  musicVolume: number;
  onMusicChange: (selectedMusicId: MusicOptionId) => void;
  onMusicMutedChange: (muted: boolean) => void;
  onMusicVolumeChange: (volume: number) => void;
  selectedMusicId: MusicOptionId;
}) {
  return (
    <div className="grid h-full content-center gap-5 rounded-2xl border border-cyan-200/20 bg-[#020711] p-8 shadow-[inset_0_0_54px_rgba(20,184,166,0.12)]">
      <div>
        <p className="text-[11px] uppercase tracking-[0.28em] text-emerald-200/70">single player active</p>
        <h2 className="mt-3 text-3xl font-black text-zinc-50">{musicLabel(selectedMusicId)}</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">
          Pick one stream for the room laptop. The player stays mounted once, so switching focus cannot stack audio.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {MUSIC_OPTIONS.map((option) => (
          <button
            className={`rounded-xl border px-4 py-4 text-left ${selectedMusicId === option.id ? "border-emerald-300/70 bg-emerald-950/45 text-emerald-100" : "border-zinc-700 bg-zinc-950/50 text-zinc-300 hover:border-cyan-200/35"}`}
            key={option.id}
            onClick={() => onMusicChange(option.id)}
            type="button"
          >
            <span className="block text-sm font-black">{option.label}</span>
            <span className="mt-2 block text-xs text-zinc-500">{option.subtitle}</span>
          </button>
        ))}
      </div>
      <button
        className={`w-fit rounded-lg border px-4 py-2 text-sm font-black uppercase tracking-widest ${musicMuted ? "border-zinc-600 bg-zinc-950 text-zinc-400" : "border-cyan-300/50 bg-cyan-950/30 text-cyan-100"}`}
        onClick={() => onMusicMutedChange(!musicMuted)}
        type="button"
      >
        {musicMuted ? "Muted" : "Mute"}
      </button>
      <label className="grid max-w-md gap-2">
        <span className="flex justify-between text-[11px] uppercase tracking-[0.22em] text-cyan-100/55">
          <span>Volume</span>
          <span>{musicVolume}%</span>
        </span>
        <input
          className="accent-cyan-300"
          max={100}
          min={0}
          onChange={(event) => onMusicVolumeChange(Number(event.currentTarget.value))}
          step={1}
          type="range"
          value={musicVolume}
        />
      </label>
    </div>
  );
}

function FocusedCostsPanel({costs, pipeline}: {costs: LaptopCostState; pipeline: LaptopPipelineState}) {
  const total = costs.summary?.userTotalCostUsd ?? 0;
  const average = costs.summary?.globalAverageCostPerLessonUsd ?? 0;
  return (
    <div className="grid h-full content-start gap-4 overflow-auto rounded-2xl border border-cyan-200/15 bg-[#050b10] p-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/65">game costs</p>
        <h2 className="mt-3 text-2xl font-black text-zinc-50">{formatUsd(total)}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
          Game worksheet costs are tracked separately from the quadratic video pipeline. Provider calls from script, speech markup, and narration stages appear here as soon as they are recorded.
        </p>
      </div>
      {costs.error ? <div className="rounded-lg border border-red-400/40 bg-red-950/35 px-3 py-2 text-sm text-red-100">{costs.error}</div> : null}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded border border-zinc-700/80 bg-zinc-950/50 p-4">
          <p className="font-mono text-[11px] uppercase tracking-wide text-zinc-500">Current run</p>
          <p className="mt-3 text-sm font-semibold text-zinc-300">{pipeline.run ? shortRunId(pipeline.run.id) : "none"}</p>
        </div>
        <div className="rounded border border-zinc-700/80 bg-zinc-950/50 p-4">
          <p className="font-mono text-[11px] uppercase tracking-wide text-zinc-500">Avg / lesson</p>
          <p className="mt-3 text-sm font-semibold text-zinc-300">{formatUsd(average)}</p>
        </div>
        <div className="rounded border border-zinc-700/80 bg-zinc-950/50 p-4">
          <p className="font-mono text-[11px] uppercase tracking-wide text-zinc-500">Paid events</p>
          <p className="mt-3 text-sm font-semibold text-zinc-300">{costs.loading ? "loading" : costs.events.length}</p>
        </div>
      </div>
      <div className="grid gap-2">
        <p className="font-mono text-[11px] uppercase tracking-wide text-cyan-100/55">Recent calls</p>
        {costs.events.length > 0 ? (
          costs.events.slice(0, 8).map((event) => (
            <div className="grid grid-cols-[1fr_auto] gap-3 rounded border border-zinc-700/80 bg-black/25 px-3 py-2" key={event.id}>
              <div className="min-w-0">
                <p className="truncate font-mono text-xs font-black uppercase text-zinc-100">
                  {event.provider} / {event.stage}
                </p>
                <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-wide text-zinc-500">
                  {event.model ?? "provider model"} / {formatQuantity(event.quantity)} {event.unitType}
                </p>
              </div>
              <p className="font-mono text-sm font-black text-emerald-200">{formatUsd(event.totalCostUsd)}</p>
            </div>
          ))
        ) : (
          <div className="rounded border border-dashed border-zinc-700/80 bg-black/20 px-3 py-4 text-sm text-zinc-500">
            {costs.loading ? "Loading game usage events..." : "No paid game pipeline calls recorded yet."}
          </div>
        )}
      </div>
    </div>
  );
}

function FocusedSettingsPanel({onSignOut, user}: {onSignOut: () => void; user: CurrentUser}) {
  return (
    <div className="grid max-w-xl gap-5">
      <div>
        <h2 className="text-2xl font-black text-zinc-50">Settings</h2>
        <p className="mt-2 text-sm text-zinc-400">Signed in as {accountDisplayName(user)}</p>
      </div>
      <button
        className="w-fit rounded-lg border border-red-400/60 bg-red-950/45 px-5 py-3 text-sm font-black uppercase tracking-widest text-red-100 hover:bg-red-900/55"
        onClick={onSignOut}
        type="button"
      >
        Sign out
      </button>
    </div>
  );
}

function FocusedDemoPanel() {
  return (
    <div className="grid h-full place-items-center rounded-2xl border border-dashed border-cyan-200/25 text-center text-cyan-50/70">
      <div>
        <h2 className="text-2xl font-black text-zinc-50">Demo video slot</h2>
        <p className="mt-3 text-sm text-zinc-400">Loom embed placeholder</p>
      </div>
    </div>
  );
}

export function musicEmbedUrl(selectedMusicId: MusicOptionId, muted: boolean, origin: string) {
  const option = MUSIC_OPTIONS.find((candidate) => candidate.id === selectedMusicId) ?? MUSIC_OPTIONS[0];
  const params = new URLSearchParams({
    autoplay: "1",
    controls: "0",
    enablejsapi: "1",
    modestbranding: "1",
    mute: muted ? "1" : "0",
    origin,
    playsinline: "1",
    rel: "0"
  });
  return `https://www.youtube.com/embed/${option.videoId}?${params.toString()}`;
}

export function musicLabel(selectedMusicId: MusicOptionId) {
  return MUSIC_OPTIONS.find((option) => option.id === selectedMusicId)?.label ?? MUSIC_OPTIONS[0].label;
}

export function formatUsd(value: number) {
  if (!Number.isFinite(value)) {
    return "$0.00";
  }
  if (Math.abs(value) > 0 && Math.abs(value) < 0.01) {
    return `$${value.toFixed(4)}`;
  }
  return `$${value.toFixed(2)}`;
}

export function formatQuantity(value: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function usernameFromAuthEmail(email: string) {
  return email.endsWith("@quadratics.xyz") ? email.slice(0, -"@quadratics.xyz".length) : email.split("@")[0];
}

function accountDisplayName(user: CurrentUser) {
  return user.displayName || (user.email ? usernameFromAuthEmail(user.email) : "user");
}
