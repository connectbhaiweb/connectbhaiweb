// First deploy only: if the database has no plans yet, load the reference data (cities, areas, plans, TIPs, DSAs, admin login).
// Later deploys find data and skip, so redeploys are fast and never touch live records.
require('dotenv').config({ path: process.env.ENV_FILE || '.env' });
const { spawnSync } = require('child_process');
const mysql = require('mysql2/promise');
(async () => {
  const url = new URL(process.env.DATABASE_URL);
  const c = await mysql.createConnection({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: url.pathname.slice(1) });
  const [[{ n }]] = await c.query('SELECT COUNT(*) AS n FROM plans');
  await c.end();
  if (n > 0) { console.log(`seed skipped: ${n} plans already present`); return; }
  console.log('empty database: loading reference data...');
  const r = spawnSync('npx', ['prisma', 'db', 'seed'], { stdio: 'inherit', env: process.env });
  if (r.status !== 0) process.exit(r.status || 1);
})().catch((e) => { console.error('seed-if-empty failed:', e.message); process.exit(1); });
