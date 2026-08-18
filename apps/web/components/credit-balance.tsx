export function CreditBalance({balance}: {balance: number | null}) {
  return (
    <div className="rounded border border-zinc-700/80 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-300">
      <span className="font-medium text-zinc-100">Credits</span>
      <span className="ml-2 font-mono">{balance ?? "..."}</span>
    </div>
  );
}
