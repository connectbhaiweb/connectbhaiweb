// Recreates the isolated test database and applies migrations before e2e tests.
const { execSync } = require('child_process');
process.env.ENV_FILE = '.env.test';
require('dotenv').config({ path: '.env.test' });
const mysql = require('mysql2/promise');
(async () => {
  const url = new URL(process.env.DATABASE_URL);
  const db = url.pathname.replace('/', '');
  if (!db.endsWith('_test')) throw new Error('Refusing to reset a non-test database: ' + db);
  const conn = await mysql.createConnection({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password) });
  await conn.query(`DROP DATABASE IF EXISTS \`${db}\``);
  await conn.query(`CREATE DATABASE \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.end();
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
  execSync('npx ts-node --transpile-only prisma/seed.ts', { stdio: 'inherit', env: process.env });
})().catch((e) => { console.error(e.message); process.exit(1); });
