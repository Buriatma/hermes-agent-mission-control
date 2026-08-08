"use client";

import React, { useEffect, useState } from "react";

interface BySourceEntry {
  source: string;
  _count: number;
  _sum: {
    input_tokens: number | null;
    output_tokens: number | null;
    cache_read_tokens: number | null;
    cache_write_tokens: number | null;
    estimated_cost_usd: number | null;
    actual_cost_usd: number | null;
  };
}

interface TopSession {
  id: string;
  source: string;
  model: string;
  title: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost_usd: number | null;
  actual_cost_usd: number | null;
  started_at: number | null;
}

interface DailyEntry {
  day: string;
  sessions: number;
  tokens: number;
  cost: number;
}

interface AnalyticsData {
  bySource: BySourceEntry[];
  topSessions: TopSession[];
  daily: DailyEntry[];
}

function fmtTokens(n: number | null | undefined): string {
  const v = n || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}

function fmtCost(n: number | null | undefined): string {
  const v = n || 0;
  if (v >= 1) return `$${v.toFixed(2)}`;
  if (v > 0) return `$${v.toFixed(4)}`;
  return "$0.00";
}

function fmtDate(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortId(id: string): string {
  if (!id) return "—";
  return id.length > 10 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

// ── Loading shimmer skeleton ────────────────────────────────
function Shimmer() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-[var(--surface-1)] border border-[var(--line)] rounded-xl p-4">
            <div className="h-3 w-20 rounded bg-[var(--surface-3)] mb-3" />
            <div className="h-7 w-28 rounded bg-[var(--surface-3)]" />
          </div>
        ))}
      </div>
      <div className="bg-[var(--surface-1)] border border-[var(--line)] rounded-xl p-4">
        <div className="h-3 w-32 rounded bg-[var(--surface-3)] mb-6" />
        <div className="flex items-end gap-2 h-40">
          {[...Array(14)].map((_, i) => (
            <div key={i} className="flex-1 rounded-t bg-[var(--surface-3)]" style={{ height: `${25 + ((i * 37) % 60)}%` }} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-[var(--surface-1)] border border-[var(--line)] rounded-xl p-4 space-y-3">
            <div className="h-3 w-40 rounded bg-[var(--surface-3)]" />
            {[...Array(5)].map((_, j) => (
              <div key={j} className="h-4 w-full rounded bg-[var(--surface-3)]" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Pure CSS bar chart with hover tooltip ───────────────────
function DailyChart({ daily }: { daily: DailyEntry[] }) {
  const last14 = daily.slice(-14).reverse();
  const max = Math.max(1, ...last14.map((d) => d.tokens));

  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-[var(--text-3)] mb-1 font-medium">
        Daily Tokens · Last 14 Days
      </p>
      <div className="flex items-end gap-1.5 h-44 pt-2">
        {last14.length === 0 && (
          <p className="text-sm text-[var(--text-3)]">No data yet.</p>
        )}
        {last14.map((d) => {
          const h = Math.max(d.tokens > 0 ? 6 : 2, (d.tokens / max) * 100);
          return (
            <div key={d.day} className="group relative flex-1 flex flex-col items-center justify-end h-full">
              {/* Tooltip */}
              <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-1.5 shadow-lg">
                <p className="text-[10px] text-[var(--text-3)]">{d.day}</p>
                <p className="text-[11px] font-medium text-[var(--text)]">
                  <span className="text-[var(--accent)]">{fmtTokens(d.tokens)}</span> tokens
                </p>
                <p className="text-[10px] text-[var(--warn)]">{fmtCost(d.cost)} · {d.sessions} session{d.sessions === 1 ? "" : "s"}</p>
              </div>
              {/* Bar */}
              <div
                className="w-full rounded-t-md transition-all duration-300 group-hover:opacity-90"
                style={{
                  height: `${h}%`,
                  background: "linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 35%, transparent))",
                  boxShadow: "0 0 12px color-mix(in srgb, var(--accent) 35%, transparent)",
                }}
              />
              {/* Date label */}
              <span className="mt-1.5 text-[9px] text-[var(--text-4)]">
                {new Date(d.day + "T00:00:00").toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone, sub }: { label: string; value: string; tone: "accent" | "warn" | "default"; sub?: string }) {
  const color = tone === "accent" ? "var(--accent)" : tone === "warn" ? "var(--warn)" : "var(--text)";
  return (
    <div className="bg-[var(--surface-1)] border border-[var(--line)] rounded-xl p-4">
      <p className="text-[11px] uppercase tracking-wider text-[var(--text-3)] font-medium">{label}</p>
      <p className="text-2xl font-semibold mt-1.5 tabular-nums" style={{ color, textShadow: tone === "accent" ? "0 0 20px color-mix(in srgb, var(--accent) 40%, transparent)" : undefined }}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-[var(--text-3)] mt-1">{sub}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/hermes/analytics", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load analytics");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <div dir="ltr" className="min-h-screen pt-16 md:pt-6 px-4 md:p-6">
        <div className="bg-[var(--surface-1)] border border-[var(--line)] rounded-xl p-6 text-center">
          <p className="text-sm font-medium text-[var(--text)] mb-1">Failed to load analytics</p>
          <p className="text-xs text-[var(--text-3)]">{error}</p>
          <button
            onClick={() => { setError(null); setData(null); window.location.reload(); }}
            className="mt-4 text-xs px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div dir="ltr" className="min-h-screen pt-16 md:pt-6 px-4 md:p-6">
        <Shimmer />
      </div>
    );
  }

  const totalSessions = data.bySource.reduce((acc, s) => acc + (s._count || 0), 0);
  const totalTokens = data.bySource.reduce((acc, s) => acc + (s._sum.input_tokens || 0) + (s._sum.output_tokens || 0), 0);
  const totalCost = data.bySource.reduce((acc, s) => acc + (s._sum.estimated_cost_usd || s._sum.actual_cost_usd || 0), 0);
  const uniqueSources = data.bySource.length;

  return (
    <div dir="ltr" className="min-h-screen pt-16 md:pt-6 px-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text)]">Cost Analytics</h1>
        <p className="text-xs text-[var(--text-3)] mt-0.5">Hermes session usage &amp; spend across all sources</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Total Sessions" value={totalSessions.toLocaleString()} tone="default" />
        <SummaryCard label="Total Tokens" value={fmtTokens(totalTokens)} tone="accent" />
        <SummaryCard label="Total Cost" value={fmtCost(totalCost)} tone="warn" sub="estimated" />
        <SummaryCard label="Unique Sources" value={String(uniqueSources)} tone="default" />
      </div>

      {/* Daily bar chart */}
      <div className="bg-[var(--surface-1)] border border-[var(--line)] rounded-xl p-4">
        <DailyChart daily={data.daily} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Source breakdown */}
        <div className="bg-[var(--surface-1)] border border-[var(--line)] rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-[var(--text-3)] font-medium mb-3">Source Breakdown</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-[var(--text-4)] border-b border-[var(--line)]">
                  <th className="py-2 pr-3 font-medium">Source</th>
                  <th className="py-2 pr-3 font-medium text-right">Count</th>
                  <th className="py-2 pr-3 font-medium text-right">Tokens</th>
                  <th className="py-2 font-medium text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {data.bySource.length === 0 && (
                  <tr><td colSpan={4} className="py-4 text-center text-[var(--text-3)]">No sessions recorded.</td></tr>
                )}
                {data.bySource.map((s) => (
                  <tr key={s.source} className="border-b border-[var(--line)]/50 last:border-0">
                    <td className="py-2 pr-3 text-[var(--text)] font-medium truncate max-w-[140px]">{s.source}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-[var(--text-2)]">{s._count}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-[var(--accent)]">{fmtTokens((s._sum.input_tokens || 0) + (s._sum.output_tokens || 0))}</td>
                    <td className="py-2 text-right tabular-nums text-[var(--warn)]">{fmtCost(s._sum.estimated_cost_usd || s._sum.actual_cost_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top 10 sessions */}
        <div className="bg-[var(--surface-1)] border border-[var(--line)] rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-[var(--text-3)] font-medium mb-3">Top 10 Sessions</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-[var(--text-4)] border-b border-[var(--line)]">
                  <th className="py-2 pr-3 font-medium">ID</th>
                  <th className="py-2 pr-3 font-medium">Source</th>
                  <th className="py-2 pr-3 font-medium">Model</th>
                  <th className="py-2 pr-3 font-medium text-right">Tokens</th>
                  <th className="py-2 pr-3 font-medium text-right">Cost</th>
                  <th className="py-2 font-medium text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.topSessions.length === 0 && (
                  <tr><td colSpan={6} className="py-4 text-center text-[var(--text-3)]">No sessions recorded.</td></tr>
                )}
                {data.topSessions.map((s) => (
                  <tr key={s.id} className="border-b border-[var(--line)]/50 last:border-0">
                    <td className="py-2 pr-3 font-mono text-[var(--text-3)]" title={s.id}>{shortId(s.id)}</td>
                    <td className="py-2 pr-3 text-[var(--text-2)]">{s.source}</td>
                    <td className="py-2 pr-3 text-[var(--text-2)] truncate max-w-[110px]" title={s.model || ""}>{s.model || "—"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-[var(--accent)]">{fmtTokens((s.input_tokens || 0) + (s.output_tokens || 0))}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-[var(--warn)]">{fmtCost(s.estimated_cost_usd || s.actual_cost_usd)}</td>
                    <td className="py-2 text-right tabular-nums text-[var(--text-3)] whitespace-nowrap">{fmtDate(s.started_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
