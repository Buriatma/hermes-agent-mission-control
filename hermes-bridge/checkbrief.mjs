import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const r = await pool.query(`SELECT data FROM "DataStore" WHERE key='hermes-briefing'`);
if (r.rows.length === 0) { console.log("NO ROW"); await pool.end(); process.exit(0); }
const d = r.rows[0].data;
console.log("TYPE:", typeof d, "isArray:", Array.isArray(d));
console.log("KEYS:", Object.keys(d));
for (const k of Object.keys(d)) {
  const v = d[k];
  console.log(k, "=>", typeof v, "| head:", typeof v === "string" ? JSON.stringify(v.slice(0, 300)) : JSON.stringify(v).slice(0, 300));
}
await pool.end();