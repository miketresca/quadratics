import {formatPomodoroClock} from "./game-runtime-storage";

export function ClockFocusPanel({
  minutes,
  onBack,
  onMinutesChange,
  onStart,
  onStop,
  remainingMs,
  timezone
}: {
  minutes: number;
  onBack: () => void;
  onMinutesChange: (minutes: number) => void;
  onStart: () => void;
  onStop: () => void;
  remainingMs: number;
  timezone: string;
}) {
  const running = remainingMs > 0;
  return (
    <div className="absolute bottom-8 right-8 z-30 w-[min(25rem,calc(100vw-2rem))] rounded border border-cyan-200/25 bg-[#050911]/90 p-4 shadow-2xl shadow-black/70 backdrop-blur-md">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan-100/60">Pomodoro timer</p>
          <h2 className="mt-1 font-mono text-3xl font-bold text-cyan-100 drop-shadow-[0_0_14px_rgba(103,232,249,0.35)]">
            {running ? formatPomodoroClock(remainingMs) : "READY"}
          </h2>
        </div>
        <button className="rounded border border-white/10 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-cyan-200/40 hover:text-cyan-100" onClick={onBack} type="button">
          Back
        </button>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {[5, 10, 15, 20, 25].map((value) => (
          <button
            className={`rounded border px-2 py-2 text-sm ${minutes === value ? "border-cyan-300/70 bg-cyan-400/15 text-cyan-100" : "border-zinc-700 bg-zinc-950/50 text-zinc-400 hover:text-zinc-100"}`}
            key={value}
            onClick={() => onMinutesChange(value)}
            type="button"
          >
            {value}
          </button>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <button className="flex-1 rounded border border-emerald-400/60 bg-emerald-950/30 px-3 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-900/40" onClick={onStart} type="button">
          Start
        </button>
        <button className="flex-1 rounded border border-red-400/35 bg-red-950/20 px-3 py-2 text-sm font-semibold text-red-100 hover:bg-red-900/30" onClick={onStop} type="button">
          Stop
        </button>
      </div>
      <p className="mt-3 text-xs text-zinc-500">Clock uses your browser time zone: {timezone}.</p>
    </div>
  );
}

export function PhoneRewardVideoPanel() {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
      <div className="pointer-events-auto aspect-[9/16] h-[min(74vh,46rem)] overflow-hidden rounded-[2rem] border border-emerald-200/25 bg-black shadow-2xl shadow-emerald-950/30">
        <iframe
          allow="autoplay; encrypted-media; picture-in-picture"
          className="h-full w-full"
          src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&playsinline=1&rel=0&modestbranding=1"
          title="Lesson reward"
        />
      </div>
    </div>
  );
}
