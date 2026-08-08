
import Database from "better-sqlite3";
const db = new Database("/opt/data/state.db", { readonly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log("TABLES:", tables.map(t => t.name).join(", "));
try {
  const sessions = db.prepare("SELECT COUNT(*) as c FROM sessions").get();
  console.log("sessions count:", sessions.c);
  const msgs = db.prepare("SELECT COUNT(*) as c FROM messages").get();
  console.log("messages count:", msgs.c);
  const s = db.prepare("SELECT id, title, source, model, started_at, message_count FROM sessions ORDER BY started_at DESC LIMIT 5").all();
  console.log("latest:", JSON.stringify(s, null, 2));
} catch(e) { console.log("query err:", e.message); }
db.close();
