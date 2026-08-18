export function CreditBalance({balance}: {balance: number | null}) {
  return (
    <div className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm">
      <span className="font-medium">Generation credits</span>
      <span className="ml-2">{balance ?? "..."}</span>
    </div>
  );
}
