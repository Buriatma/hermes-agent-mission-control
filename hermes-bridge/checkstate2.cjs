
const Database = require('better-sqlite3');
const db = new Database('/opt/data/state.db', { readonly: true });
const cols = db.prepare("PRAGMA table_info(sessions)").all();
console.log("SESSIONS COLS:", cols.map(c => c.name).join(", "));
const mcols = db.prepare("PRAGMA table_info(messages)").all();
console.log("MESSAGES COLS:", mcols.map(c => c.name).join(", "));
const s = db.prepare("SELECT * FROM sessions ORDER BY started_at DESC LIMIT 2").all();
console.log("SAMPLE SESSION:", JSON.stringify(s, null, 1).slice(0, 1200));
const m = db.prepare("SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp LIMIT 3").all(s[0]?.id);
console.log("SAMPLE MSGS:", JSON.stringify(m, null, 1).slice(0, 800));
db.close();
