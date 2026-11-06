// Runs at every start (see start:deploy). It only ever ADDS missing reference/demo data; it never touches live records.
//  1. Empty database (no plans): load the reference data (cities, areas, plans, OTT apps, pincode mappings, admin login).
//  2. SEED_SAMPLE_DATA=true and the demo customers are not there yet: load them too (60 customers with leads, installs,
//     payments, tickets and chat). The seeder is idempotent, so a later start finds them and skips.
require('dotenv').config({ path: process.env.ENV_FILE || '.env' });
const { spawnSync } = require('child_process');
const mysql = require('mysql2/promise');
(async () => {
  const url = new URL(process.env.DATABASE_URL);
  const c = await mysql.createConnection({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: url.pathname.slice(1) });
  const [[{ n }]] = await c.query('SELECT COUNT(*) AS n FROM plans');
  const [[{ demo }]] = await c.query("SELECT COUNT(*) AS demo FROM users WHERE role = 'customer' AND phone LIKE '981%'");
  await c.end();
  const wantDemo = process.env.SEED_SAMPLE_DATA === 'true';
  if (n > 0 && !(wantDemo && demo < 20)) { console.log(`seed skipped: ${n} plans present${wantDemo ? `, ${demo} demo customers present` : ''}`); return; }
  console.log(n === 0 ? 'empty database: loading reference data...' : 'adding demo data (SEED_SAMPLE_DATA=true)...');
  const r = spawnSync('npx', ['prisma', 'db', 'seed'], { stdio: 'inherit', env: process.env });
  if (r.status !== 0) process.exit(r.status || 1);
})().catch((e) => { console.error('seed-if-empty failed:', e.message); process.exit(1); });
