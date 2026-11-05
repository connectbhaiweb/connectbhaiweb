// Uploads the provider logos (frontend/public/logos/*) to Cloudinary (public, folder connectbhai/logos) and saves
// their Cloudinary paths in plan_categories.logo_url. Safe to run again (overwrites the same public ids).
require('dotenv').config({ path: process.env.ENV_FILE || '.env' });
const fs = require('fs'), path = require('path'), crypto = require('crypto'), mysql = require('mysql2/promise');
const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
const API = (process.env.CLOUDINARY_API_URL || 'https://api.cloudinary.com/v1_1').replace(/\/$/, '');
if (!cloud || !key || !secret) { console.error('Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env first.'); process.exit(1); }
const DIR = path.join(__dirname, '../../frontend/public/logos');
const BRANDS = { BSNL: 'bsnl', Jio: 'jio', Airtel: 'airtel' };
const sign = (p) => crypto.createHash('sha1').update(Object.keys(p).sort().map((k) => `${k}=${p[k]}`).join('&') + secret).digest('hex');
(async () => {
  const url = new URL(process.env.DATABASE_URL);
  const db = await mysql.createConnection({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: url.pathname.slice(1) });
  for (const [brand, file] of Object.entries(BRANDS)) {
    const params = { folder: 'connectbhai/logos', overwrite: 'true', public_id: file, timestamp: Math.floor(Date.now() / 1000), type: 'upload' };
    const fd = new FormData();
    Object.entries({ ...params, api_key: key, signature: sign(params) }).forEach(([k, v]) => fd.append(k, v));
    fd.append('file', new Blob([fs.readFileSync(path.join(DIR, `${file}.svg`))], { type: 'image/svg+xml' }), `${file}.svg`);
    const r = await fetch(`${API}/${cloud}/image/upload`, { method: 'POST', body: fd }), j = await r.json();
    if (!r.ok) { console.error(`${brand}: upload failed: ${j.error && j.error.message}`); process.exit(1); }
    // store only the path; the API builds the full URL from CLOUDINARY_DELIVERY_URL + CLOUDINARY_CLOUD_NAME
    const stored = `v${j.version}/${j.public_id}.${j.format}`;
    await db.query('UPDATE plan_categories SET logo_url = ? WHERE name = ?', [stored, brand]);
    console.log(`${brand}: ${stored}`);
  }
  await db.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
