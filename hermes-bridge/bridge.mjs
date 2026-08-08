#!/usr/bin/env node
/**
 * Hermy HQ ↔ Hermes bridge.
 *
 * Runs on the Mac mini where Hermes lives. Talks to the shared Postgres
 * (the same DATABASE_URL the website uses) — nothing is exposed to the
 * internet. Two jobs:
 *
 *   PULL  (Hermes → website): mirror the kanban board into HermesTask,
 *         cron list + health into DataStore, and emit activity events.
 *   PUSH  (website → Hermes): pick up AgentRequest rows that are `queued`
 *         (safe) or `approved` (human-approved side-effecting), run them
 *         through the `hermes` CLI, and write results back.
 *
 * Requires: the `hermes` binary on PATH, and env DATABASE_URL.
 * Optional env: HERMES_BOARD (default "default"), BRIDGE_POLL_MS (5000),
 *               BRIDGE_MIRROR_MS (30000), HERMES_BIN (default "hermes").
 */
import pg from "pg";
import Database from "better-sqlite3";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const execFileP = promisify(execFile);
const HERMES = process.env.HERMES_BIN || "hermes";
const BOARD = process.env.HERMES_BOARD || "default";
const POLL_MS = Number(process.env.BRIDGE_POLL_MS || 5000);
const MIRROR_MS = Number(process.env.BRIDGE_MIRROR_MS || 30000);
const RUN_TIMEOUT_MS = Number(process.env.BRIDGE_RUN_TIMEOUT_MS || 240000);
const WIKI_DIR = process.env.HERMES_WIKI || path.join(os.homedir(), ".hermes", "wiki");
const STATE_DB = process.env.HERMES_STATE_DB || "/opt/data/state.db";
const BRIEF_HOUR = Number(process.env.BRIEF_HOUR || 8);   // local hour to auto-generate the daily brief
const BRIEF_PROMPT =
  "You are the operator's chief of staff. Produce today's brief. Read your memory wiki open-loops " +
  "(~/.hermes/wiki), the kanban board, and recent activity. Output ONLY valid JSON (no prose, no code fences) " +
  'in exactly this shape: {"greeting":"one warm line","summary":"2-3 sentences on where things stand",' +
  '"sections":[{"label":"Needs your decision","items":["..."]},{"label":"Top priorities","items":["..."]},' +
  '{"label":"Recently shipped","items":["..."]},{"label":"Next actions","items":["..."]}]}. ' +
  "Keep every item short, concrete, and specific. Omit a section if it has nothing.";
let lastBriefDate = null;

const DB_URL = process.env.DATABASE_URL || "";
if (!DB_URL) { console.error("DATABASE_URL is required (use the direct postgres:// URL, not a prisma:// Accelerate URL)"); process.exit(1); }
if (DB_URL.startsWith("prisma://") || DB_URL.startsWith("prisma+")) {
  console.error("DATABASE_URL is a Prisma Accelerate URL; the bridge needs a DIRECT postgres:// connection string (e.g. POSTGRES_URL).");
  process.exit(1);
}
// Cloud Postgres (Prisma Postgres/Neon/Supabase/RDS) needs SSL; localhost doesn't.
const isLocal = /@(localhost|127\.0\.0\.1)/.test(DB_URL);
const pool = new pg.Pool({ connectionString: DB_URL, max: 4, ssl: isLocal ? undefined : { rejectUnauthorized: false } });

const log = (...a) => console.log(new Date().toISOString(), ...a);
const q = (text, params) => pool.query(text, params);

async function hermes(args, { timeout = 30000 } = {}) {
  const { stdout } = await execFileP(HERMES, args, { timeout, maxBuffer: 8 * 1024 * 1024 });
  return stdout;
}

async function emit(kind, title, { detail = null, agent = "hermes", level = "info", meta = null } = {}) {
  await q(
    `INSERT INTO "AgentEvent" (id, kind, title, detail, agent, level, meta, "createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7, now())`,
    [randomUUID(), kind, title.slice(0, 200), detail, agent, level, meta ? JSON.stringify(meta) : null]
  );
}

async function setStore(key, data) {
  await q(
    `INSERT INTO "DataStore" (key, data, "updatedAt") VALUES ($1,$2, now())
     ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, "updatedAt" = now()`,
    [key, JSON.stringify(data)]
  );
}

/* ─────────────── PULL: mirror Hermes → Postgres ─────────────── */
async function mirrorKanban() {
  let tasks = [];
  try {
    // NB: this Hermes CLI wants --board BEFORE the subcommand.
    const out = await hermes(["kanban", "--board", BOARD, "list", "--json"], { timeout: 15000 });
    const parsed = JSON.parse(out || "[]");
    tasks = Array.isArray(parsed) ? parsed : parsed.tasks || [];
  } catch (e) { log("kanban list failed:", e.message.split("\n")[0]); return; }

  const seen = new Set();
  for (const t of tasks) {
    const id = String(t.id ?? t.task_id ?? "");
    if (!id) continue;
    seen.add(id);
    await q(
      `INSERT INTO "HermesTask" (id, board, title, assignee, status, priority, result, "updatedAt", "syncedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7, now(), now())
       ON CONFLICT (id) DO UPDATE SET
         title=EXCLUDED.title, assignee=EXCLUDED.assignee, status=EXCLUDED.status,
         priority=EXCLUDED.priority, result=EXCLUDED.result, "syncedAt"=now()`,
      [id, BOARD, String(t.title ?? "untitled").slice(0, 300), t.assignee ?? null,
       String(t.status ?? "todo"), t.priority != null ? Number(t.priority) : null,
       t.result ? String(t.result).slice(0, 2000) : null]
    );
  }
  // prune tasks that vanished from the board
  if (seen.size) {
    await q(`DELETE FROM "HermesTask" WHERE board=$1 AND id <> ALL($2::text[])`, [BOARD, [...seen]]);
  } else {
    await q(`DELETE FROM "HermesTask" WHERE board=$1`, [BOARD]);
  }
}

async function mirrorCrons() {
  try {
    const out = await hermes(["cron", "list", "--all"], { timeout: 15000 });
    const lines = out.split("\n").map((l) => l.trimEnd()).filter(Boolean);
    await setStore("hermes-crons", { jobs: lines, raw: out.slice(0, 8000), syncedAt: new Date().toISOString() });
  } catch (e) { log("cron list failed:", e.message.split("\n")[0]); }
}

async function mirrorCost() {
  for (const args of [["insights", "--days", "7"], ["insights"]]) {
    try {
      const out = await hermes(args, { timeout: 15000 });
      await setStore("hermes-cost", { summary: out.slice(0, 4000), syncedAt: new Date().toISOString() });
      return;
    } catch { /* try next arg shape */ }
  }
}

async function mirrorHealth() {
  let online = false, gateway = "unknown", detail = "";
  try {
    const out = await hermes(["status"], { timeout: 12000 });
    detail = out.slice(0, 4000);
    online = /online|running|connected/i.test(out);
    gateway = /gateway[^\n]*(running|online)/i.test(out) ? "running" : "stopped";
  } catch (e) { detail = e.message.split("\n")[0]; }
  await setStore("hermes-health", { online, gateway, detail, lastSeen: new Date().toISOString() });
}

/* ─────────────── Memory Wiki (warm tier: git-tracked markdown) ─────────────── */
function parseEntry(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const fm = {}; let body = md;
  if (m) {
    body = m[2];
    for (const line of m[1].split("\n")) {
      const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/);
      if (!kv) continue;
      const v = kv[2].trim();
      if (v.startsWith("[") && v.endsWith("]")) fm[kv[1]] = v.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
      else fm[kv[1]] = v === "null" || v === "" ? null : v;
    }
  }
  return { fm, body: body.trim() };
}
function walkMd(dir, out = []) {
  let items = [];
  try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const it of items) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) { if (it.name !== ".git") walkMd(full, out); }
    else if (it.name.endsWith(".md") && it.name !== "INDEX.md") out.push(full);
  }
  return out;
}
async function mirrorWiki() {
  if (!fs.existsSync(WIKI_DIR)) return;
  const seen = new Set();
  for (const file of walkMd(WIKI_DIR)) {
    const rel = path.relative(WIKI_DIR, file);
    const id = rel.replace(/\.md$/, "");
    seen.add(id);
    let raw = ""; try { raw = fs.readFileSync(file, "utf8"); } catch { continue; }
    const { fm, body } = parseEntry(raw);
    await q(
      `INSERT INTO "HermesMemory" (id, path, type, title, status, confidence, provenance, tags, links, body, "validFrom", "validTo", "updatedAt", "syncedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now(), now())
       ON CONFLICT (id) DO UPDATE SET path=EXCLUDED.path, type=EXCLUDED.type, title=EXCLUDED.title,
         status=EXCLUDED.status, confidence=EXCLUDED.confidence, provenance=EXCLUDED.provenance,
         tags=EXCLUDED.tags, links=EXCLUDED.links, body=EXCLUDED.body,
         "validFrom"=EXCLUDED."validFrom", "validTo"=EXCLUDED."validTo", "syncedAt"=now()`,
      [id, rel, fm.type || "fact", fm.title || id, fm.status || "active", fm.confidence || null,
       fm.provenance || null, Array.isArray(fm.tags) ? fm.tags : [], Array.isArray(fm.links) ? fm.links : [],
       body, fm.valid_from || null, fm.valid_to || null]
    );
  }
  if (seen.size) await q(`DELETE FROM "HermesMemory" WHERE id <> ALL($1::text[])`, [[...seen]]);
  else await q(`DELETE FROM "HermesMemory"`);
}
function writeWikiEntry(e) {
  const rel = e.path || `${e.type || "note"}s/${e.id}.md`;
  const full = path.join(WIKI_DIR, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  const now = new Date().toISOString().slice(0, 10);
  const lines = [
    "---", `id: ${e.id}`, `type: ${e.type || "note"}`, `title: ${e.title}`,
    `status: ${e.status || "active"}`,
    e.confidence ? `confidence: ${e.confidence}` : null,
    `provenance: ${e.provenance || "dashboard"}`,
    `tags: [${(e.tags || []).join(", ")}]`, `links: [${(e.links || []).join(", ")}]`,
    `updated: ${now}`, "---", "", e.body || "", "",
  ].filter((l) => l !== null);
  fs.writeFileSync(full, lines.join("\n"), "utf8");
  return rel;
}
async function gitCommitWiki(msg) {
  try {
    if (!fs.existsSync(path.join(WIKI_DIR, ".git"))) await execFileP("git", ["-C", WIKI_DIR, "init"]).catch(() => {});
    await execFileP("git", ["-C", WIKI_DIR, "add", "-A"]).catch(() => {});
    await execFileP("git", ["-C", WIKI_DIR, "commit", "-m", msg]).catch(() => {});
  } catch { /* ignore */ }
}

/* ─────────────── Chief-of-staff daily brief ─────────────── */
function extractBrief(raw) {
  let jsonStr = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const m = jsonStr.match(/\{[\s\S]*\}/);
  if (m) jsonStr = m[0];
  try { return JSON.parse(jsonStr); } catch {
    // best-effort: pull out summary/sections via regex
    const sum = () => {
      const a = jsonStr.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      return a ? a[1].replace(/\\"/g, '"') : null;
    };
    const sec = (() => {
      const a = jsonStr.match(/"sections"\s*:\s*(\[[\s\S]*?\])/);
      if (!a) return [];
      try { return JSON.parse(a[1].replace(/\\"/g, '"')); } catch { return []; }
    })();
    return { summary: sum(), sections: sec };
  }
}
async function generateBriefing() {
  const raw = (await hermes(["-z", BRIEF_PROMPT], { timeout: RUN_TIMEOUT_MS })).trim();
  let brief;
  try {
    brief = extractBrief(raw);
  } catch { brief = { summary: raw.slice(0, 1500), sections: [] }; }
  brief.generatedAt = new Date().toISOString();
  await setStore("hermes-briefing", brief);
  await emit("status", "Daily brief generated", { level: "up" });
}
async function maybeDailyBrief() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (now.getHours() >= BRIEF_HOUR && lastBriefDate !== today) {
    lastBriefDate = today;
    try { await generateBriefing(); } catch (e) { log("daily brief err", e.message); }
  }
}

/* ─────────────── PUSH: run website requests via Hermes ─────────────── */
async function runRequest(r) {
  await q(`UPDATE \"AgentRequest\" SET status='running', \"startedAt\"=now(), \"updatedAt\"=now() WHERE id=$1`, [r.id]);
  await emit("run", `Started: ${r.title}`, { level: "info", meta: { requestId: r.id, kind: r.kind } });
  try {
    let result = "";
    if (r.kind === "oneshot" || r.kind === "chat") {
      result = (await hermes(["-z", r.prompt || r.title], { timeout: RUN_TIMEOUT_MS })).trim();
    } else if (r.kind === "kanban") {
      result = (await hermes(["kanban", "--board", BOARD, "create", "--json", r.title], { timeout: 20000 })).trim();
    } else if (r.kind.startsWith("cron.")) {
      const op = r.kind.split(".")[1];
      const a = JSON.parse(r.prompt || "{}");
      const argv =
        op === "create" ? ["cron", "create", a.schedule, a.prompt || a.name].filter(Boolean)
        : op === "run"    ? ["cron", "run", a.id || a.name]
        : op === "pause"  ? ["cron", "pause", a.id || a.name]
        : op === "resume" ? ["cron", "resume", a.id || a.name]
        : op === "remove" ? ["cron", "remove", a.id || a.name]
        : op === "edit"   ? ["cron", "edit", a.id || a.name]
        : null;
      if (!argv) throw new Error(`unknown cron op ${op}`);
      result = (await hermes(argv, { timeout: 20000 })).trim();
      await mirrorCrons();
    } else if (r.kind === "memory.write") {
      const e = JSON.parse(r.prompt || "{}");
      const rel = writeWikiEntry(e);
      await gitCommitWiki(`wiki: update ${rel} (via dashboard)`);
      await mirrorWiki();
      result = `wrote ${rel}`;
    } else if (r.kind === "file.write") {
      const f = JSON.parse(r.prompt || "{}");
      const target = f.path || "";
      const ROOT_DIR = "/opt/data";
      if (!target.startsWith(ROOT_DIR)) throw new Error("path escape");
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, String(f.content || ""), "utf-8");
      await mirrorFiles();
      result = "wrote " + target;
    } else if (r.kind === "briefing.generate") {
      await generateBriefing();
      lastBriefDate = new Date().toISOString().slice(0, 10);
      result = "brief updated";
    } else {
      throw new Error(`unknown kind ${r.kind}`);
    }
    await q(`UPDATE \"AgentRequest\" SET status='done', result=$2, \"finishedAt\"=now(), \"updatedAt\"=now() WHERE id=$1`,
      [r.id, result.slice(0, 8000)]);
    await emit("run", `Done: ${r.title}`, { level: "up", detail: result.slice(0, 400), meta: { requestId: r.id } });
    // Update agent activity state
    const agentMap = { max: "Chief of Staff", sage: "X Specialist", knox: "Trading Ops", nova: "YouTube Strategy", pixel: "Web Specialist" };
    for (const [aid, role] of Object.entries(agentMap)) {
      if (r.title.toLowerCase().includes(aid) || r.prompt?.toLowerCase().includes(aid)) {
        try {
          const now = new Date().toISOString();
          const existing = await q(`SELECT * FROM "AgentState" WHERE id=$1`).then(r => r.rows[0]).catch(() => null);
          if (existing) {
            await q(`UPDATE "AgentState" SET status='idle', "currentTask"=$2, "lastActive"=$3 WHERE id=$1`, [aid, r.title.slice(0, 80), now]);
          } else {
            await q(`INSERT INTO "AgentState" (id, status, "currentTask", "lastActive", "tasksCompleted", "totalCost") VALUES ($1,'idle',$2,$3,0,0)`, [aid, r.title.slice(0, 80), now]);
          }
        } catch {}
      }
    }
  } catch (e) {
    const msg = (e.stderr || e.message || "error").toString().split("\n")[0].slice(0, 600);
    await q(`UPDATE \"AgentRequest\" SET status='failed', error=$2, \"finishedAt\"=now(), \"updatedAt\"=now() WHERE id=$1`, [r.id, msg]);
    await emit("run", `Failed: ${r.title}`, { level: "down", detail: msg, meta: { requestId: r.id } });
    log("request failed:", r.id, msg);
  }
}

async function processQueue() {
  let rows = [];
  try {
    // Skip requests stuck in 'running' for >5 min and reset them to queued
    await q(`UPDATE "AgentRequest" SET status='queued', "updatedAt"=now()
             WHERE status='running' AND "startedAt" < now() - interval '5 minutes'`);
    const r = await q(
      `SELECT * FROM "AgentRequest" WHERE status IN ('queued','approved','approved_oneshot') ORDER BY "createdAt" ASC LIMIT 2`
    );
    rows = r.rows;
  } catch (e) { log("processQueue query err", e.message); return; }
  log("processQueue: found", rows.length, "pending");
  for (const r of rows) await runRequest(r);
}




/* ─────────────── Mirror: VPS files → Neon ─────────────── */
async function mirrorFiles() {
  const ROOT_DIR = "/opt/data";
  const ALLOWED = ["obsidian-vault", "home", "scripts", "config.yaml", "KNOWLEDGE", "skills"];
  const entries = [];
  
  function walk(dir, depth) {
    if (depth > 4) return;
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const full = path.join(dir, item.name);
        const rel = full.slice(ROOT_DIR.length + 1) || "/";
        if (item.name.startsWith(".") || item.name === "node_modules") continue;
        const relParts = rel.split("/");
        if (!ALLOWED.some(a => rel.startsWith(a))) continue;
        try {
          const stat = fs.statSync(full);
          entries.push({ name: item.name, path: rel, type: item.isDirectory() ? "dir" : "file", size: stat.size, updatedAt: stat.mtime.toISOString(), parent: path.dirname(rel).slice(ROOT_DIR.length + 1) || null });
          if (item.isDirectory()) walk(full, depth + 1);
        } catch {}
      }
    } catch {}
  }
  
  try {
    walk(ROOT_DIR, 0);
    log("mirrorFiles: found", entries.length, "entries, inserting...");
    for (const e of entries) {
      try {
        await q(`INSERT INTO "HermesFile" (path, name, type, size, parent, "updatedAt", "syncedAt")
           VALUES ($1,$2,$3,$4,$5,$6,now())
           ON CONFLICT (path) DO UPDATE SET name=$2, type=$3, size=$4, parent=$5, "updatedAt"=$6, "syncedAt"=now()`,
          [e.path, e.name, e.type, e.size || null, e.parent, e.updatedAt]);
      } catch (err) { log("mirrorFiles insert err", e.path, err.message); }
    }
    // Remove files not seen in this sync
    await q(`DELETE FROM "HermesFile" WHERE "syncedAt" < now() - interval '5 minutes'`);
    log("mirrorFiles: synced", entries.length, "entries");
  } catch (e) { log("mirrorFiles err", e.message); }
}

/* ─────────────── Mirror: Git commits → Neon ─────────────── */
async function mirrorGit() {
  try {
    const out = await execFileP("git", ["-C", "/opt/data/home/hermes-agent-mission-control", "log", "--oneline", "-20"]);
    const commits = out.trim().split("\n").filter(Boolean).map(line => {
      const [hash, ...rest] = line.split(" ");
      return { hash: hash.slice(0, 7), message: rest.join(" ").slice(0, 200) };
    });
    await setStore("hermes-git", { commits, syncedAt: new Date().toISOString() });
  } catch (e) { log("mirrorGit err", e.message); }
}

/* ─────────────── Mirror: state.db → Neon ─────────────── */
function mirrorSessions() {
  if (!fs.existsSync(STATE_DB)) return;
  const local = new Database(STATE_DB, { readonly: true });
  try {
    const sessions = local.prepare(`SELECT id, source, model, title, started_at, ended_at, end_reason, message_count, tool_call_count, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens, estimated_cost_usd, actual_cost_usd, billing_provider FROM sessions ORDER BY started_at DESC LIMIT 200`).all();
    // Get preview from first user message
    const getPreview = local.prepare(`SELECT content FROM messages WHERE session_id = ? AND role = 'user' AND content IS NOT NULL ORDER BY timestamp LIMIT 1`);

    for (const s of sessions) {
      const preview = getPreview.get(s.id);
      const p = preview ? (preview.content || '').slice(0, 200) : '';
      const lastMsg = local.prepare(`SELECT MAX(timestamp) as last_active FROM messages WHERE session_id = ?`).get(s.id);
      q(`INSERT INTO "HermesSession" (id, source, model, title, "started_at", "ended_at", "end_reason", "message_count", "tool_call_count", "input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens", "reasoning_tokens", "estimated_cost_usd", "actual_cost_usd", "billing_provider", preview, "last_active", "synced_at")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19, now())
         ON CONFLICT (id) DO UPDATE SET source=$2, model=$3, title=$4, "ended_at"=$6, "end_reason"=$7, "message_count"=$8, "tool_call_count"=$9, "input_tokens"=$10, "output_tokens"=$11, "cache_read_tokens"=$12, "cache_write_tokens"=$13, "reasoning_tokens"=$14, "estimated_cost_usd"=$15, "actual_cost_usd"=$16, "billing_provider"=$17, preview=$18, "last_active"=$19, "synced_at"=now()`,
        [s.id, s.source, s.model, s.title, s.started_at, s.ended_at, s.end_reason, s.message_count, s.tool_call_count, s.input_tokens, s.output_tokens, s.cache_read_tokens, s.cache_write_tokens, s.reasoning_tokens, s.estimated_cost_usd, s.actual_cost_usd, s.billing_provider, p, lastMsg?.last_active]);
    }

    // Mirror recent messages (last 5000 across recent sessions)
    const msgs = local.prepare(`SELECT id, session_id, role, content, tool_call_id, tool_calls, tool_name, timestamp, token_count, finish_reason FROM messages WHERE session_id IN (SELECT id FROM sessions ORDER BY started_at DESC LIMIT 50) ORDER BY timestamp`).all();
    for (const m of msgs) {
      const tc = m.tool_calls ? JSON.stringify(m.tool_calls) : null;
      q(`INSERT INTO "HermesMessage" (id, session_id, role, content, tool_call_id, tool_calls, tool_name, timestamp, token_count, finish_reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO UPDATE SET content=$4, tool_calls=$6, finish_reason=$10`,
        [m.id, m.session_id, m.role, m.content, m.tool_call_id, tc, m.tool_name, m.timestamp, m.token_count, m.finish_reason]);
    }
    log("mirrorSessions: synced", sessions.length, "sessions,", msgs.length, "msgs");
  } catch (e) { log("mirrorSessions err", e.message); } finally { local.close(); }
}

/* ─────────────── loops ─────────────── */
async function mirrorTick() {
  try { await mirrorKanban(); } catch (e) { log("mirrorKanban err", e.message); }
  try { await mirrorCrons(); } catch (e) { log("mirrorCrons err", e.message); }
  try { await mirrorHealth(); } catch (e) { log("mirrorHealth err", e.message); }
  try { await mirrorWiki(); } catch (e) { log("mirrorWiki err", e.message); }
  try { await mirrorCost(); } catch (e) { log("mirrorCost err", e.message); }
  try { await maybeDailyBrief(); } catch (e) { log("maybeDailyBrief err", e.message); }
  try { mirrorSessions(); } catch (e) { log("mirrorSessions err", e.message); }
  try { mirrorGit(); } catch (e) { log("mirrorGit err", e.message); }
  // mirrorFiles runs in background — too many inserts to block tick
  try { mirrorFiles(); } catch (e) { log("mirrorFiles err", e.message); }
}

async function main() {
  log(`hermes-bridge up · board=${BOARD} · poll=${POLL_MS}ms · mirror=${MIRROR_MS}ms`);
  await emit("status", "Bridge connected", { level: "up" });
  await mirrorTick();
  setInterval(() => mirrorTick().catch((e) => log("mirror loop", e.message)), MIRROR_MS);
  // queue loop
  const tick = async () => { try { await processQueue(); } catch (e) { log("queue loop", e.message); } finally { setTimeout(tick, POLL_MS); } };
  tick();
}
main().catch((e) => { console.error("fatal", e); process.exit(1); });
