import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const r = await pool.query('SELECT id, status, "createdAt" FROM "AgentRequest" ORDER BY "createdAt" DESC LIMIT 5');
console.log(JSON.stringify(r.rows, null, 2));
await pool.end();
