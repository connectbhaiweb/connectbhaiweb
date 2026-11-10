#!/usr/bin/env node
/**
 * Removes EVERY record that belongs to one or more mobile numbers: the user account(s) (any role), leads they raised,
 * waitlist entries, OTP codes and WhatsApp notification logs, plus everything hanging off them (bookings, charges,
 * commissions, tickets, chat, devices ...). Rows of OTHER people that merely point at the account (e.g. a lead assigned to a
 * deleted TIP) are kept and the link is cleared instead.
 *
 *   DATABASE_URL="mysql://..." node scripts/purge-phones.js 6265007710 8684985410          # dry run: only counts
 *   DATABASE_URL="mysql://..." node scripts/purge-phones.js 6265007710 8684985410 --yes    # really deletes (one transaction)
 *
 * It cannot be undone. Take a database backup first.
 */
const { PrismaClient } = require('@prisma/client');
const args = process.argv.slice(2);
const yes = args.includes('--yes');
const phones = args.filter((a) => /^\d{10}$/.test(a));
if (!phones.length) { console.error('Give at least one 10-digit mobile number.'); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error('Set DATABASE_URL to the database you mean.'); process.exit(1); }
const prisma = new PrismaClient();
const list = phones.map((p) => `'${p}'`).join(',');

// where each phone lives: [table, condition]
const ROOTS = [['users', `phone IN (${list})`], ['leads', `customer_phone IN (${list})`], ['waitlist', `phone IN (${list})`], ['otp_codes', `phone IN (${list})`], ['notifications', `phone IN (${list})`]];

async function fks(db) {
  return prisma.$queryRawUnsafe(`
    SELECT k.TABLE_NAME t, k.COLUMN_NAME c, k.REFERENCED_TABLE_NAME rt, k.REFERENCED_COLUMN_NAME rc, col.IS_NULLABLE nullable
    FROM information_schema.KEY_COLUMN_USAGE k
    JOIN information_schema.COLUMNS col ON col.TABLE_SCHEMA = k.TABLE_SCHEMA AND col.TABLE_NAME = k.TABLE_NAME AND col.COLUMN_NAME = k.COLUMN_NAME
    WHERE k.TABLE_SCHEMA = '${db}' AND k.REFERENCED_TABLE_NAME IS NOT NULL`);
}

/** Plans the work: returns steps [{op:'delete'|'null', table, col?, cond}] children first. */
function plan(all, table, cond, seen = new Set(), out = []) {
  const key = `${table}|${cond}`;
  if (seen.has(key) || seen.size > 400) return out;
  seen.add(key);
  for (const f of all.filter((x) => x.rt === table)) {
    const sub = `SELECT ${f.rc} FROM (SELECT ${f.rc} FROM ${table} WHERE ${cond}) _s`;
    const childCond = `${f.c} IN (${sub})`;
    if (f.nullable === 'YES' || f.t === table) out.push({ op: 'null', table: f.t, col: f.c, cond: childCond });
    else { plan(all, f.t, childCond, seen, out); out.push({ op: 'delete', table: f.t, cond: childCond }); }
  }
  return out;
}

(async () => {
  const [{ db }] = await prisma.$queryRawUnsafe('SELECT DATABASE() db');
  console.log(`Database: ${db}\nPhones: ${phones.join(', ')}\nMode: ${yes ? 'DELETE' : 'dry run (nothing is changed)'}\n`);
  const all = await fks(db);
  const steps = [];
  for (const [t, c] of ROOTS) { plan(all, t, c, new Set(), steps); steps.push({ op: 'delete', table: t, cond: c }); }
  const counts = [];
  for (const s of steps) {
    const [{ n }] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) n FROM ${s.table} WHERE ${s.cond}`);
    counts.push({ ...s, n: Number(n) });
  }
  for (const s of counts.filter((x) => x.n)) console.log(`${s.op === 'delete' ? 'delete' : 'unlink'} ${String(s.n).padStart(5)}  ${s.table}${s.col ? '.' + s.col : ''}`);
  if (!counts.some((x) => x.n)) { console.log('Nothing found for these numbers.'); return; }
  const users = await prisma.$queryRawUnsafe(`SELECT id, role, name, phone, partner_status FROM users WHERE phone IN (${list})`);
  console.log('\nAccounts:', users);
  if (!yes) { console.log('\nDry run only. Re-run with --yes to delete.'); return; }
  await prisma.$transaction(async (tx) => {
    for (const s of steps) {
      if (s.op === 'null') await tx.$executeRawUnsafe(`UPDATE ${s.table} SET ${s.col} = NULL WHERE ${s.cond}`);
      else await tx.$executeRawUnsafe(`DELETE FROM ${s.table} WHERE ${s.cond}`);
    }
  }, { timeout: 120000 });
  console.log('\nDone.');
})().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
