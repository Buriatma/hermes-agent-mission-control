"use client";

import { useEffect, useState, useRef } from "react";
import { Activity, HardDrive, Zap, GitCommit, GitBranch, RefreshCw, Radio } from "lucide-react";

// ── Types ─────────────────────────────────────────────────
interface BridgeHealth {
  online: boolean;
  gateway?: string;
  lastSeen?: string | number | null;
  uptimeSec?: number;
  startedAt?: string | null;
}

interface SessionRow {
  id: string;
  source?: string | null;
  model?: string | null;
  title?: string | null;
  started_at?: number | null;
  ended_at?: number | null;
  end_reason?: string | null;
  message_count?: number;
  tool_call_count?: number;
  input_tokens?: number;
  output_tokens?: number;
  estimated_cost_usd?: number | null;
  actual_cost_usd?: number | null;
  preview?: string | null;
  last_active?: number | null;
}

interface SessionList {
  sessions: SessionRow[];
  total: number;
}

interface AnalyticsData {
  bySource?: { source: string | null; _count: number; _sum?: any }[];
  topSessions?: SessionRow[];
  daily?: { day: string; sessions: number; tokens: number; cost: number }[];
}

interface Briefing {
  generatedAt?: string | null;
  greeting?: string | null;
  summary?: string | null;
  sections?: { title?: string; points?: string[] }[];
}

interface GitCommitRow {
  hash?: string;
  message?: string;
  author?: string;
  date?: string | number | null;
}

interface GitData {
  commits: GitCommitRow[];
  branch?: string;
  syncedAt?: string | null;
}

interface AgentRequest {
  id: string;
  origin?: string;
  kind?: string;
  title?: string;
  prompt?: string | null;
  status: string;
  result?: string | null;
  error?: string | null;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
}

interface RequestsData {
  requests: AgentRequest[];
  pending: number;
}

interface FilesData {
  files: unknown[];
  total: number;
}

// ── Helpers ───────────────────────────────────────────────
function fmtExact(n: number) { return n.toLocaleString("en-US"); }
function fmtUsd(n: number) {
  if (!n || isNaN(n)) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}
function fmtTokens(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}
function timeAgo(ts: number | string | null | undefined) {
  if (!ts) return "—";
  const t = typeof ts === "string" ? Date.parse(ts) : ts * 1000;
  if (isNaN(t)) return "—";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
function fmtUptime(sec: number) {
  if (!sec || sec <= 0) return null;
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
function fmtDate(ts: number | string | null | undefined) {
  if (!ts) return "—";
  const t = typeof ts === "string" ? Date.parse(ts) : ts * 1000;
  if (isNaN(t)) return "—";
  return new Date(t).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Still up";
}
function shortId(id: string) {
  return id.length > 12 ? id.slice(0, 12) : id;
}
function statusColor(s: string) {
  const k = s.toLowerCase();
  if (k === "done" || k === "completed" || k === "approved") return "var(--up)";
  if (k === "running" || k === "approved_oneshot") return "var(--accent)";
  if (k === "failed" || k === "rejected" || k === "cancelled") return "var(--down)";
  if (k === "awaiting_approval") return "var(--warn)";
  return "var(--text-3)";
}

// ── Skeleton ──────────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`sk ${className}`} />;
}

// ── Section label ─────────────────────────────────────────
function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="eyebrow">{children}</span>
      <span className="h-px flex-1 bg-[var(--line)]" />
      {right}
    </div>
  );
}

// ── Bridge status panel ───────────────────────────────────
function BridgePanel({ health }: { health: BridgeHealth | null }) {
  const online = !!health?.online;
  return (
    <div className="panel flex flex-col p-6 h-full">
      <div className="flex items-center gap-2 mb-4">
        <Radio className="w-3.5 h-3.5" style={{ color: online ? "var(--up)" : "var(--down)" }} />
        <span className="eyebrow">Bridge Status</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="relative flex w-2.5 h-2.5">
          {online && <span className="absolute inline-flex h-full w-full rounded-full animate-ping" style={{ background: "color-mix(in srgb, var(--up) 60%, transparent)" }} />}
          <span className="relative inline-flex w-2.5 h-2.5 rounded-full" style={{ background: online ? "var(--up)" : "var(--down)", boxShadow: `0 0 12px ${online ? "rgba(0,255,136,0.6)" : "rgba(255,51,102,0.6)"}` }} />
        </span>
        <span className="text-[15px] font-semibold" style={{ color: online ? "var(--up)" : "var(--down)" }}>
          {online ? "ONLINE" : "OFFLINE"}
        </span>
      </div>
      <div className="mt-4 space-y-2 text-[12.5px]">
        <div className="flex justify-between">
          <span className="text-[var(--text-3)]">Gateway</span>
          <span className="num text-[var(--text-2)]">{health?.gateway || "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--text-3)]">Uptime</span>
          <span className="num text-[var(--text-2)]">{fmtUptime(health?.uptimeSec || 0) || "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--text-3)]">Last seen</span>
          <span className="num text-[var(--text-2)]">{timeAgo(health?.lastSeen ?? null)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Sessions summary ──────────────────────────────────────
function SessionsPanel({ sessions, total, analytics }: { sessions: SessionRow[]; total: number; analytics: AnalyticsData | null }) {
  const today = new Date().toISOString().slice(0, 10);
  const activeToday = (analytics?.daily || []).filter(d => d.day === today).reduce((a, d) => a + d.sessions, 0);
  const todayCost = (analytics?.daily || []).filter(d => d.day === today).reduce((a, d) => a + d.cost, 0);
  const lastCost = (sessions[0]?.estimated_cost_usd || sessions[0]?.actual_cost_usd || 0);

  const stat = (label: string, value: string, sub: string, color = "var(--text)") => (
    <div className="rounded-lg border border-[var(--line)] bg-white/[0.02] p-3.5">
      <div className="eyebrow !text-[9.5px] mb-1.5">{label}</div>
      <div className="num font-semibold text-[26px] leading-none tracking-[-0.02em]" style={{ color, textShadow: "0 0 20px color-mix(in srgb, var(--accent) 40%, transparent)" }}>{value}</div>
      <div className="num text-[var(--text-3)] text-[11px] mt-1.5">{sub}</div>
    </div>
  );

  return (
    <div className="panel flex flex-col p-6 h-full">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
        <span className="eyebrow">Sessions</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {stat("Total", fmtExact(total), "mirrored sessions", "var(--accent)")}
        {stat("Active today", fmtExact(activeToday), "sessions started today", "var(--up)")}
        {stat("Cost today", fmtUsd(todayCost), "estimated USD", "var(--warn)")}
      </div>
      {sessions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[var(--line)]">
          <div className="eyebrow !text-[9.5px] mb-2">Last session</div>
          <p className="text-[13px] text-[var(--text-2)] line-clamp-1">{sessions[0]?.preview || sessions[0]?.title || sessions[0]?.id}</p>
          <div className="num text-[11px] text-[var(--text-3)] mt-1.5">
            {sessions[0]?.model || "—"} · {fmtTokens((sessions[0]?.input_tokens || 0) + (sessions[0]?.output_tokens || 0))} tok · {fmtUsd(lastCost)} · {timeAgo(sessions[0]?.started_at ?? null)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Briefing panel ────────────────────────────────────────
function BriefingPanel({ briefing }: { briefing: Briefing | null }) {
  return (
    <div className="panel flex flex-col p-6 h-full">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[15px] leading-none" style={{ textShadow: "0 0 12px rgba(0,240,255,0.5)" }}>◈</span>
        <span className="eyebrow">Morning Briefing</span>
        {briefing?.generatedAt && <span className="num ml-auto text-[10.5px] text-[var(--text-4)]">{timeAgo(briefing.generatedAt)}</span>}
      </div>
      {briefing?.summary ? (
        <>
          {briefing.greeting && <p className="text-[14px] font-semibold text-[var(--text)] mb-1.5">{briefing.greeting}</p>}
          <p className="text-[13.5px] leading-relaxed text-[var(--text-2)] whitespace-pre-wrap">{briefing.summary}</p>
          {briefing.sections && briefing.sections.length > 0 && (
            <div className="mt-4 space-y-3">
              {briefing.sections.map((s, i) => (
                <div key={i} className="rounded-lg border border-[var(--line)] bg-white/[0.02] p-3">
                  <div className="eyebrow !text-[9.5px] mb-1.5" style={{ color: "var(--accent)" }}>{s.title || `Section ${i + 1}`}</div>
                  {Array.isArray(s.points) && s.points.length > 0 ? (
                    <ul className="space-y-1">
                      {s.points.map((p, j) => <li key={j} className="text-[12.5px] text-[var(--text-2)] leading-snug">{p}</li>)}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-[13px] text-[var(--text-3)] italic">No briefing yet.</p>
      )}
    </div>
  );
}

// ── Recent dispatch requests ──────────────────────────────
function RequestsPanel({ data }: { data: RequestsData | null }) {
  const reqs = data?.requests || [];
  return (
    <div className="panel flex flex-col p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5" style={{ color: "var(--warn)" }} />
          <span className="eyebrow">Dispatch Requests</span>
        </div>
        {(data?.pending ?? 0) > 0 && (
          <span className="num text-[10.5px] px-2 py-0.5 rounded-full border"
            style={{ color: "var(--warn)", borderColor: "rgba(255,204,0,0.3)", background: "rgba(255,204,0,0.08)" }}>
            {data!.pending} pending approval
          </span>
        )}
      </div>
      {reqs.length === 0 ? (
        <p className="text-[13px] text-[var(--text-3)] italic py-6 text-center">No dispatch requests yet.</p>
      ) : (
        <div className="space-y-0">
          {reqs.slice(0, 10).map((r) => (
            <div key={r.id} className="flex items-center gap-3 py-2.5 border-b border-[var(--line)] last:border-0">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusColor(r.status), boxShadow: `0 0 8px ${statusColor(r.status)}` }} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-[var(--text-2)] leading-snug line-clamp-1">{r.title || r.prompt || shortId(r.id)}</p>
                <div className="num text-[10.5px] text-[var(--text-4)] mt-0.5">
                  {shortId(r.id)} · {timeAgo(r.createdAt)}
                </div>
              </div>
              <span className="num text-[10px] px-1.5 py-0.5 rounded-md border shrink-0"
                style={{ color: statusColor(r.status), borderColor: `color-mix(in srgb, ${statusColor(r.status)} 30%, transparent)`, background: `color-mix(in srgb, ${statusColor(r.status)} 10%, transparent)` }}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Files sync ────────────────────────────────────────────
function FilesPanel({ data }: { data: FilesData | null }) {
  return (
    <div className="panel flex flex-col p-6 h-full">
      <div className="flex items-center gap-2 mb-4">
        <HardDrive className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
        <span className="eyebrow">Files Sync</span>
      </div>
      <div className="num font-semibold text-[40px] leading-[0.95] tracking-[-0.02em] text-[var(--text)]"
        style={{ textShadow: "0 0 20px color-mix(in srgb, var(--accent) 40%, transparent)" }}>
        {data ? fmtExact(data.total) : "—"}
      </div>
      <div className="eyebrow !text-[9.5px] mt-2">files mirrored from vault</div>
      <div className="mt-auto pt-4">
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-3)]">
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full animate-ping" style={{ background: "color-mix(in srgb, var(--up) 60%, transparent)" }} />
            <span className="relative inline-flex w-1.5 h-1.5 rounded-full" style={{ background: "var(--up)" }} />
          </span>
          <span className="num">mirror sync active</span>
        </div>
      </div>
    </div>
  );
}

// ── Git activity ──────────────────────────────────────────
function GitPanel({ data }: { data: GitData | null }) {
  const commits = data?.commits || [];
  return (
    <div className="panel flex flex-col p-6 h-full">
      <div className="flex items-center gap-2 mb-4">
        <GitBranch className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
        <span className="eyebrow">Git Activity</span>
        {data?.branch && <span className="num ml-auto text-[10.5px] px-1.5 py-0.5 rounded border text-[var(--text-3)] border-[var(--line)]">{data.branch}</span>}
      </div>
      {commits.length === 0 ? (
        <p className="text-[13px] text-[var(--text-3)] italic py-6 text-center">No commits yet.</p>
      ) : (
        <div className="space-y-0">
          {commits.slice(0, 5).map((c, i) => (
            <div key={c.hash || i} className="flex gap-3 py-2.5 border-b border-[var(--line)] last:border-0">
              <GitCommit className="w-3.5 h-3.5 text-[var(--text-3)] shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-[var(--text-2)] leading-snug line-clamp-2">{c.message || "—"}</p>
                <div className="num text-[10.5px] text-[var(--text-4)] mt-0.5">
                  {(c.hash || "").slice(0, 7) || "—"} · {c.author || "—"} · {timeAgo(c.date ?? null)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────
export default function Dashboard() {
  const [health, setHealth] = useState<BridgeHealth | null>(null);
  const [sessions, setSessions] = useState<SessionList | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [requests, setRequests] = useState<RequestsData | null>(null);
  const [files, setFiles] = useState<FilesData | null>(null);
  const [git, setGit] = useState<GitData | null>(null);
  const [time, setTime] = useState(new Date());
  const [mounted, setMounted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchJson = async (url: string) => {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`${url} → ${r.status}`);
    return r.json();
  };

  const load = async () => {
    setRefreshing(true);
    const settled = await Promise.allSettled([
      fetchJson("/api/hermes/health"),
      fetchJson("/api/hermes/sessions?limit=5"),
      fetchJson("/api/hermes/analytics"),
      fetchJson("/api/hermes/briefing"),
      fetchJson("/api/hermes/requests?take=10"),
      fetchJson("/api/hermes/files?limit=1"),
      fetchJson("/api/hermes/git"),
    ]);
    const [h, s, a, b, rq, f, g] = settled.map(p => (p.status === "fulfilled" ? p.value : null));
    if (h) setHealth(h);
    if (s) setSessions(s);
    if (a) setAnalytics(a);
    if (b) setBriefing(b);
    if (rq) setRequests(rq);
    if (f) setFiles(f);
    if (g) setGit(g);
    setRefreshing(false);
  };

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, []);

  if (!mounted) return null;

  const rise = (i: number) => ({ animationDelay: `${i * 60}ms` });

  return (
    <>
      <div className="relative z-10 w-full mx-auto pb-16">

        {/* ── Header ─────────────────────────────────────── */}
        <div className="hq-rise pt-4 pb-10 flex flex-wrap items-end justify-between gap-6" style={rise(0)}>
          <div>
            <div className="eyebrow mb-2.5">{greeting()}</div>
            <h1 className="text-[40px] font-semibold tracking-[-0.025em] leading-none text-[var(--text)]">Hermes Mission Control</h1>
            <p className="num text-[var(--text-3)] text-[12.5px] mt-3">
              {time.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              {"  ·  "}
              {time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white/[0.02] px-3 py-1.5">
              <span className="relative flex w-1.5 h-1.5">
                {health?.online && <span className="absolute inline-flex h-full w-full rounded-full animate-ping" style={{ background: "color-mix(in srgb, var(--up) 60%, transparent)" }} />}
                <span className="relative inline-flex w-1.5 h-1.5 rounded-full" style={{ background: health?.online ? "var(--up)" : "var(--down)" }} />
              </span>
              <span className="num text-[11px] font-medium" style={{ color: health ? (health.online ? "var(--up)" : "var(--down)") : "var(--text-3)" }}>
                {health ? (health.online ? "Bridge online" : "Bridge offline") : "…"}
              </span>
            </div>
            <button
              onClick={load}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white/[0.02] px-3 py-1.5 text-[11px] font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--line-strong)] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Row 1: Bridge · Sessions · Files ───────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-start">
          <div className="hq-rise" style={rise(1)}>
            {health ? <BridgePanel health={health} /> : <div className="panel p-6"><Skeleton className="h-40" /></div>}
          </div>
          <div className="hq-rise" style={rise(2)}>
            {sessions ? <SessionsPanel sessions={sessions.sessions} total={sessions.total} analytics={analytics} /> : <div className="panel p-6"><Skeleton className="h-40" /></div>}
          </div>
          <div className="hq-rise md:col-span-2 xl:col-span-1" style={rise(3)}>
            {files ? <FilesPanel data={files} /> : <div className="panel p-6"><Skeleton className="h-40" /></div>}
          </div>
        </div>

        {/* ── Row 2: Briefing ─────────────────────────────── */}
        <div className="mt-5 hq-rise" style={rise(4)}>
          {briefing ? <BriefingPanel briefing={briefing} /> : <div className="panel p-6"><Skeleton className="h-48" /></div>}
        </div>

        {/* ── Row 3: Requests · Git ───────────────────────── */}
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <div className="hq-rise" style={rise(5)}>
            {requests ? <RequestsPanel data={requests} /> : <div className="panel p-6"><Skeleton className="h-56" /></div>}
          </div>
          <div className="hq-rise" style={rise(6)}>
            {git ? <GitPanel data={git} /> : <div className="panel p-6"><Skeleton className="h-56" /></div>}
          </div>
        </div>

      </div>
    </>
  );
}
