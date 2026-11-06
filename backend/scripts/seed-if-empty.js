// Runs at every start (see start:deploy). It only ever ADDS missing reference/demo data; it never touches live records.
//  1. Empty database (no plans): load the reference data (cities, areas, plans, OTT apps, pincode mappings, admin login).
//  2. SEED_SAMPLE_DATA=true and the demo customers are not there yet: load them too (60 customers with leads, installs,
//     payments, tickets and chat). The seeder is idempotent, so a later start finds them and skips.
require('dotenv').config({ path: process.env.ENV_FILE || '.env' });
const { spawnSync } = require('child_process');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
(async () => {
  const url = new URL(process.env.DATABASE_URL);
  const c = await mysql.createConnection({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: url.pathname.slice(1) });
  const [[{ n }]] = await c.query('SELECT COUNT(*) AS n FROM plans');
  const [[{ demo }]] = await c.query("SELECT COUNT(*) AS demo FROM users WHERE role = 'customer' AND phone LIKE '981%'");
  // Provider logos live in Cloudinary (connectbhai/logos/<brand>.svg, uploaded with `npm run logos:upload`). Point the catalogue at them when Cloudinary is configured.
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    const [r] = await c.query("UPDATE plan_categories SET logo_url = CONCAT('connectbhai/logos/', LOWER(name), '.svg') WHERE name IN ('BSNL','Jio','Airtel') AND (logo_url IS NULL OR logo_url LIKE '/logos/%')");
    if (r.affectedRows) console.log(`provider logos now served from Cloudinary (${r.affectedRows} rows)`);
  }
  // TESTING ONLY: while SEED_SAMPLE_DATA=true, the admin and one sample DSA, TIP and customer share one known password
  // (SEED_DEMO_PASSWORD, default Demo@Connect2026) so they can be tried without a WhatsApp OTP. Turn SEED_SAMPLE_DATA off for a live system.
  const demoPw = process.env.SEED_DEMO_PASSWORD || (process.env.SEED_SAMPLE_DATA === 'true' ? 'Demo@Connect2026' : '');
  if (demoPw.length >= 10) {
    const hash = await bcrypt.hash(demoPw, 10);
    const adminPhone = process.env.SEED_ADMIN_PHONE || '9999999999';
    const [r] = await c.query("UPDATE users SET password_hash = ? WHERE (role = 'admin' AND phone = ?) OR (role = 'dsa' AND phone = '9000000001') OR (role = 'tip' AND phone = '9100000001') OR (role = 'customer' AND phone = '9811000000')", [hash, adminPhone]);
    if (r.affectedRows) console.log(`demo password set on ${r.affectedRows} accounts`);
  }
  await c.end();
  const wantDemo = process.env.SEED_SAMPLE_DATA === 'true';
  if (n > 0 && !(wantDemo && demo < 20)) { console.log(`seed skipped: ${n} plans present${wantDemo ? `, ${demo} demo customers present` : ''}`); return; }
  console.log(n === 0 ? 'empty database: loading reference data...' : 'adding demo data (SEED_SAMPLE_DATA=true)...');
  const r = spawnSync('npx', ['prisma', 'db', 'seed'], { stdio: 'inherit', env: process.env });
  if (r.status !== 0) process.exit(r.status || 1);
})().catch((e) => { console.error('seed-if-empty failed:', e.message); process.exit(1); });
