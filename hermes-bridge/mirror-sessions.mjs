import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");

const STATE_DB = "/opt/data/state.db";
const NEON_URL = "https://ep-frosty-waterfall-azg2ykg6-pooler.c-3.ap-southeast-1.aws.neon.tech";
const NEON_KEY = "npg_eodiEZHkpT91";
const NEON_DB = "neondb";

async function sql(query, params = []) {
  const res = await fetch(`${NEON_URL}/sql`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Neon-Connection-String": `postgresql://neondb_owner:${NEON_KEY}@${NEON_URL.replace("https://", "")}/${NEON_DB}?sslmode=require` },
    body: JSON.stringify({ query, params }),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`SQL err ${res.status}: ${t.slice(0, 200)}`); }
  return res.json();
}

// Simpler: use pg pool but with timeout
import pg from "pg";
const pool = new pg.Pool({
  connectionString: `postgresql://neondb_owner:${NEON_KEY}@${NEON_URL.replace("https://", "")}/${NEON_DB}?sslmode=require`,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
  query_timeout: 30000,
  statement_timeout: 30000,
});

async function mirror() {
  const db = new Database(STATE_DB, { readonly: true });
  try {
    const sessions = db.prepare(`SELECT id, source, model, title, started_at, ended_at, end_reason, message_count, tool_call_count, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens, estimated_cost_usd, actual_cost_usd, billing_provider FROM sessions ORDER BY started_at DESC LIMIT 200`).all();
    const getPreview = db.prepare(`SELECT content FROM messages WHERE session_id = ? AND role = 'user' AND content IS NOT NULL ORDER BY timestamp LIMIT 1`);
    const getLastActive = db.prepare(`SELECT MAX(timestamp) as last_active FROM messages WHERE session_id = ?`);

    let syncCount = 0;
    for (const s of sessions) {
      const preview = getPreview.get(s.id);
      const p = preview ? (preview.content || "").slice(0, 200) : "";
      const la = getLastActive.get(s.id);
      await pool.query(
        `INSERT INTO "HermesSession" (id, source, model, title, "started_at", "ended_at", "end_reason", "message_count", "tool_call_count", "input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens", "reasoning_tokens", "estimated_cost_usd", "actual_cost_usd", "billing_provider", preview, "last_active", "synced_at")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19, now())
         ON CONFLICT (id) DO UPDATE SET source=$2, model=$3, title=$4, "ended_at"=$6, "end_reason"=$7, "message_count"=$8, "tool_call_count"=$9, "input_tokens"=$10, "output_tokens"=$11, "cache_read_tokens"=$12, "cache_write_tokens"=$13, "reasoning_tokens"=$14, "estimated_cost_usd"=$15, "actual_cost_usd"=$16, "billing_provider"=$17, preview=$18, "last_active"=$19, "synced_at"=now()`,
        [s.id, s.source, s.model, s.title, s.started_at, s.ended_at, s.end_reason, s.message_count, s.tool_call_count, s.input_tokens, s.output_tokens, s.cache_read_tokens, s.cache_write_tokens, s.reasoning_tokens, s.estimated_cost_usd, s.actual_cost_usd, s.billing_provider, p, la?.last_active]
      );
      syncCount++;
      if (syncCount % 20 === 0) console.log(`  sessions synced: ${syncCount}/${sessions.length}`);
    }
    console.log(`sessions: ${syncCount} synced`);

    // Mirror messages for top 30 sessions
    const msgs = db.prepare(`SELECT id, session_id, role, content, tool_call_id, tool_calls, tool_name, timestamp, token_count, finish_reason FROM messages WHERE session_id IN (SELECT id FROM sessions ORDER BY started_at DESC LIMIT 30) ORDER BY timestamp`).all();
    let msgCount = 0;
    for (const m of msgs) {
      const tc = m.tool_calls ? (typeof m.tool_calls === "string" ? m.tool_calls : JSON.stringify(m.tool_calls)) : null;
      await pool.query(
        `INSERT INTO "HermesMessage" (id, session_id, role, content, tool_call_id, tool_calls, tool_name, timestamp, token_count, finish_reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO UPDATE SET content=$4, tool_calls=$6, finish_reason=$10`,
        [m.id, m.session_id, m.role, m.content, m.tool_call_id, tc, m.tool_name, m.timestamp, m.token_count, m.finish_reason]
      );
      msgCount++;
      if (msgCount % 100 === 0) console.log(`  msgs synced: ${msgCount}/${msgs.length}`);
    }
    console.log(`messages: ${msgCount} synced`);
    console.log("DONE");
  } catch (e) { console.error("ERR:", e.message); }
  finally { db.close(); await pool.end(); }
}

mirror();
