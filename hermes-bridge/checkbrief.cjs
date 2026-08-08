
const {Pool} = require('/opt/data/home/hermes-agent-mission-control/hermes-bridge/node_modules/pg');
const pool = new Pool({connectionString: 'postgresql://neondb_owner:npg_eodiEZHkpT91@ep-frosty-waterfall-azg2ykg6-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require', ssl: {rejectUnauthorized: false}});
pool.query('SELECT data FROM "DataStore" WHERE key=\'hermes-briefing\'').then(async r => {
  if (!r.rows.length) { console.log('NO ROW'); await pool.end(); process.exit(0); }
  const d = r.rows[0].data;
  console.log('TYPE:', typeof d, 'isArray:', Array.isArray(d));
  console.log('KEYS:', Object.keys(d));
  for (const k of Object.keys(d)) {
    const v = d[k];
    if (typeof v === 'string') console.log(k, '=> string head:', JSON.stringify(v.slice(0, 400)));
    else console.log(k, '=>', JSON.stringify(v).slice(0, 400));
  }
  await pool.end();
}).catch(e => { console.error(e.message); process.exit(1); });
