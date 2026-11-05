// Creates the database named in DATABASE_URL if it does not exist (local/dev convenience).
require('dotenv').config({ path: process.env.ENV_FILE || '.env' });
const mysql = require('mysql2/promise');
(async () => {
  const url = new URL(process.env.DATABASE_URL);
  const db = url.pathname.replace('/', '');
  const conn = await mysql.createConnection({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password) });
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  console.log(`database ready: ${db}`);
  await conn.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
