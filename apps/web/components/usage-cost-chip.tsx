"use client";

import type {UsageEventItem, UsageSummary} from "@quadratics/types";
import {useState} from "react";

const emptyUsageSummary: UsageSummary = {
  userTotalCostUsd: 0,
  userTotalQuantity: 0,
  userBreakdown: [],
  globalAverageCostPerVideoUsd: 0,
  globalAverageCostPerVideoWithoutAvatarUsd: 0,
  globalAverageCostPerVideoWithAvatarUsd: 0,
  globalVideoCount: 0,
  globalBreakdown: []
};

export function UsageCostChip({
  events,
  signedIn,
  summary
}: {
  events: UsageEventItem[];
  signedIn: boolean;
  summary: UsageSummary | null;
}) {
  const [open, setOpen] = useState(false);

  if (!signedIn) {
    return null;
  }

  const usage = summary ?? emptyUsageSummary;
  const total = usage.userTotalCostUsd;
  const baseAverage = usage.globalAverageCostPerVideoWithoutAvatarUsd ?? usage.globalAverageCostPerVideoUsd;
  const avatarAverage = usage.globalAverageCostPerVideoWithAvatarUsd ?? baseAverage;

  return (
    <div
      className="absolute left-1/2 hidden -translate-x-1/2 sm:block"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
      onFocus={() => setOpen(true)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div
        aria-label={`Usage spend ${formatCurrency(total)}`}
        className={[
          "flex h-10 items-center gap-2 rounded border bg-zinc-950/55 px-3 font-mono text-[11px] tracking-wide shadow-xl shadow-black/25 backdrop-blur transition",
          open
            ? "border-emerald-400/40 text-emerald-200"
            : "border-zinc-800 text-zinc-300"
        ].join(" ")}
        tabIndex={0}
      >
        <span className="text-zinc-500">$</span>
        <span>{formatCurrency(total)}</span>
        <span className="text-zinc-700">/</span>
        <span className="text-zinc-500">base {formatCurrency(baseAverage)}</span>
        <span className="text-zinc-700">/</span>
        <span className="text-pink-200/80">hgn {formatCurrency(avatarAverage)}</span>
      </div>
      {open ? (
        <div className="absolute left-1/2 top-10 z-[300] w-96 -translate-x-1/2 pt-2">
          <div className="rounded border border-zinc-700/80 bg-[#090d13]/92 p-3 text-xs text-zinc-300 shadow-[0_22px_70px_rgba(0,0,0,0.62),0_0_34px_rgba(16,185,129,0.08)] backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="font-mono uppercase tracking-wide text-zinc-500">Spend</span>
              <span className="font-mono text-emerald-200">{formatCurrency(total)}</span>
            </div>
            <div className="mt-3 grid gap-2">
              <div className="flex justify-between">
                <span>Average / base video</span>
                <span>{formatCurrency(baseAverage)}</span>
              </div>
              <div className="flex justify-between text-pink-100">
                <span>Average / with HeyGen</span>
                <span>{formatCurrency(avatarAverage)}</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>Videos sampled</span>
                <span>{usage.globalVideoCount}</span>
              </div>
            </div>
            <div className="mt-3 border-t border-zinc-800 pt-3">
              <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-wide text-zinc-500">
                <span>Recent calls</span>
                <span>{events.length}</span>
              </div>
              {events.length > 0 ? (
                <div className="grid max-h-64 gap-1 overflow-auto pr-1">
                  {events.map((event) => (
                    <div className="rounded border border-zinc-800/80 bg-black/25 px-2.5 py-2" key={event.id}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate font-mono text-[11px] uppercase tracking-wide text-zinc-200">
                          {event.provider} / {event.stage}
                        </span>
                        <span className="shrink-0 font-mono text-emerald-200">{formatCurrency(event.costUsd)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-wide text-zinc-500">
                        <span className="truncate">{event.model ?? event.unitType}</span>
                        <span className="shrink-0">
                          {formatQuantity(event.quantity)} {event.unitType}
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-zinc-600">
                        {formatUsageTime(event.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-zinc-500">No provider spend recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatUsageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function formatCurrency(value: number) {
  if (value > 0 && value < 0.01) {
    return `$${value.toFixed(4)}`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}
