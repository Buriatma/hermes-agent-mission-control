
const pg = require('/opt/data/home/hermes-agent-mission-control/hermes-bridge/node_modules/pg');
const pool = new pg.Pool({ connectionString: 'postgresql://neondb_owner:npg_eodiEZHkpT91@ep-frosty-waterfall-azg2ykg6-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require', ssl: { rejectUnauthorized: false } });

async function fix() {
  const r = await pool.query(`SELECT data FROM "DataStore" WHERE key='hermes-briefing'`);
  if (!r.rows.length) { console.log("NO DATA"); await pool.end(); return; }
  const d = r.rows[0].data;
  let summary = d.summary || "";
  
  // Strip fences
  summary = summary.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/g, "").trim();
  
  let parsed = null;
  try { parsed = JSON.parse(summary); } catch {
    // Regex extract from malformed JSON
    const sumM = summary.match(/"summary"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"/);
    const greetM = summary.match(/"greeting"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"/);
    const secM = summary.match(/"sections"\s*:\s*(\[[\s\S]*?\])/);
    let secs = [];
    if (secM) { try { secs = JSON.parse(secM[1].replace(/\\"/g, '"')); } catch {} }
    parsed = {
      greeting: greetM ? greetM[1].replace(/\\"/g, '"') : "Operator brief,",
      summary: sumM ? sumM[1].replace(/\\"/g, '"') : summary,
      sections: secs,
      generatedAt: d.generatedAt || new Date().toISOString()
    };
  }
  
  const clean = {
    generatedAt: parsed.generatedAt || d.generatedAt || new Date().toISOString(),
    greeting: parsed.greeting || null,
    summary: parsed.summary || summary,
    sections: Array.isArray(parsed.sections) ? parsed.sections : []
  };
  
  await pool.query(
    'UPDATE "DataStore" SET data = $1, "updatedAt" = now() WHERE key = $2',
    [clean, 'hermes-briefing']
  );
  console.log("FIXED. summary starts with:", clean.summary.slice(0, 80));
  console.log("sections:", clean.sections.length);
  await pool.end();
}

fix().catch(e => { console.error(e.message); process.exit(1); });
