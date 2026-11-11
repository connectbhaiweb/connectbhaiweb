/* Seeds the database from the sample Excel data (exported to prisma/seed-data/*.json) + settings + admin. Starting data only: no customers, leads, bookings, payments, tickets or chat.
   Idempotent: safe to run many times. Never touches data created by real users. */
import 'dotenv/config';
import { PrismaClient, PlanType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { join } from 'path';
import { encrypt, last4 } from '../src/common/utils/crypto';

const prisma = new PrismaClient();
const j = (f: string) => JSON.parse(readFileSync(join(__dirname, 'seed-data', f), 'utf8'));
const KEY = process.env.DATA_ENCRYPTION_KEY!;
const num = (v: any, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const norm = (s: string) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

async function settings() {
  const defs: Record<string, [string | undefined, string, string]> = {
    tip_onboarding_fee: [process.env.TIP_ONBOARDING_FEE, '0', 'TIP pays this (before GST) when filling the registration form'],
    tip_install_fee: [process.env.TIP_INSTALL_FEE, '0', 'TIP pays this (before GST) for each installed lead'],
    care_plan_fee_per_lead: [process.env.CARE_PLAN_FEE_PER_LEAD, '0', 'TIP pays this (before GST) per lead to enable Care Plan'],
    dsa_payout_per_lead: [process.env.DSA_PAYOUT_PER_LEAD, '0', 'Paid to DSA only when the lead is installed'],
    gst_percent: [process.env.GST_PERCENT, '18', 'GST on all TIP charges'],
    auto_assign: [process.env.AUTO_ASSIGN === 'false' ? '0' : '1', '1', '1 = assign new leads to a TIP by pincode automatically'],
  };
  for (const [key, [v, d, description]] of Object.entries(defs)) {
    await prisma.appSetting.upsert({ where: { key }, update: {}, create: { key, value: String(v ?? d), description } });
  }
}

async function cities() {
  const list: [string, 'live' | 'soon'][] = [['Indore', 'live'], ['Bhopal', 'soon'], ['Ujjain', 'soon'], ['Dewas', 'soon'], ['Ratlam', 'soon'], ['Jabalpur', 'soon'], ['Gwalior', 'soon']];
  for (const [name, status] of list) await prisma.city.upsert({ where: { name }, update: {}, create: { name, status } });
  return prisma.city.findUniqueOrThrow({ where: { name: 'Indore' } });
}

async function areas(cityId: bigint) {
  const rows: { name: string; pincode: string }[] = [];
  for (const r of j('pincode_tip.json')) rows.push({ name: `${r['Name']}, ${r['Name of Tehsil/SDCA']}`, pincode: String(r['Pin Code']) });
  for (const r of j('catalogue.json').pincodes) rows.push({ name: String(r['Area / Locality']), pincode: String(r['Pincode']) });
  const seen = new Set<string>();
  const data = rows.filter((r) => /^[1-9]\d{5}$/.test(r.pincode)).filter((r) => { const k = `${r.name}|${r.pincode}`; return !seen.has(k) && seen.add(k); }).map((r) => ({ city_id: cityId, name: r.name.slice(0, 120), pincode: r.pincode }));
  await prisma.area.createMany({ data, skipDuplicates: true });
  return data.length;
}

async function catalogue() {
  const cat = j('catalogue.json');
  const catIds = new Map<string, bigint>();
  const category = async (name: string, type: PlanType) => {
    const k = `${name}|${type}`;
    if (!catIds.has(k)) {
      const c = await prisma.planCategory.upsert({ where: { name_type: { name, type } }, update: {}, create: { name, type, sort_order: catIds.size } });
      catIds.set(k, c.id);
    }
    return catIds.get(k)!;
  };
  const ottIds = new Map<string, bigint>();
  const ott = async (name: string) => {
    const n = name.trim();
    if (!ottIds.has(n)) ottIds.set(n, (await prisma.ottApp.upsert({ where: { name: n }, update: {}, create: { name: n } })).id);
    return ottIds.get(n)!;
  };
  const planIds = new Map<string, bigint>();
  const brandOf = new Map<string, string>();

  for (const p of cat.plans.filter((x: any) => x['Plan_ID'] && x['Brand'])) {
    const type: PlanType = String(p['Technology']).includes('Air') ? 'airfiber' : 'fiber';
    const channels = String(p['Live TV Channels'] ?? '');
    const row = await prisma.plan.upsert({
      where: { plan_code: p['Plan_ID'] },
      update: {},
      create: {
        plan_code: p['Plan_ID'], category_id: await category(p['Brand'], type), name: p['Plan Name'],
        speed_mbps: num(p['Speed_Mbps']) || null, data_limit: p['Data_GB (FUP/month)'] ? `${p['Data_GB (FUP/month)']} GB` : 'Unlimited',
        price: num(p['Price_incl_GST (Rs/month)']), install_charge: num(p['Installation (Rs)']), router_charge: 0, needs_install: true,
        has_tv: channels !== '' && channels !== '-' && channels !== 'None', tv_channels: parseInt(channels) || null,
        benefits: {
          price_ex_gst: num(p['Price_ex_GST (Rs/month)']), speed_after_fup: p['Speed after FUP'], voice: p['Voice Calling'], live_tv: channels || null,
          set_top_box: p['Set-top Box'], security_deposit: num(p['Security Deposit (Rs)']), validity_options: p['Validity Options'],
          segment: p['Category'], suitable_for: p['Suitable_For'], remarks: p['Remarks'],
        },
      },
    });
    planIds.set(p['Plan_ID'], row.id);
    brandOf.set(p['Plan_ID'], p['Brand']);
    for (const n of String(p['OTT Apps Included'] ?? '').split(',').map((s) => s.trim()).filter((s) => s && s !== '-' && s.toLowerCase() !== 'none')) {
      await prisma.planOttApp.upsert({ where: { plan_id_ott_app_id: { plan_id: row.id, ott_app_id: await ott(n) } }, update: {}, create: { plan_id: row.id, ott_app_id: await ott(n) } });
    }
  }
  // standalone TV / OTT packs (no installer needed)
  for (const k of cat.packs.filter((x: any) => x['Pack_ID'] && x['Brand'])) {
    const type: PlanType = String(k['Type']).toLowerCase().includes('tv') ? 'tv' : 'ott';
    const row = await prisma.plan.upsert({
      where: { plan_code: k['Pack_ID'] }, update: {},
      create: {
        plan_code: k['Pack_ID'], category_id: await category(k['Brand'], type), name: k['Pack Name'], price: Math.round(num(k['Price (Rs, ex GST)']) * 1.18), needs_install: false,
        has_tv: type === 'tv', benefits: { price_ex_gst: num(k['Price (Rs, ex GST)']), billing: k['Billing'], channels: k['Live TV Channels'], ott: k['OTT Apps'], notes: k['Requirement / Notes'], can_be_added_to: k['Can Be Added To'] },
      },
    });
    planIds.set(k['Pack_ID'], row.id);
    brandOf.set(k['Pack_ID'], k['Brand']);
  }
  // pincode -> plan availability
  const maps: { pincode: string; plan_id: bigint; is_available: boolean }[] = [];
  const brandPins = new Map<string, Set<string>>();
  for (const m of cat.map) {
    const plan_id = planIds.get(m['Plan_ID']);
    if (!plan_id) continue;
    const ok = String(m['Available']).toUpperCase() === 'Y';
    maps.push({ pincode: String(m['Pincode']), plan_id, is_available: ok });
    if (ok) { const b = String(m['Brand']); (brandPins.get(b) ?? brandPins.set(b, new Set()).get(b)!).add(String(m['Pincode'])); }
  }
  for (const k of cat.packs.filter((x: any) => x['Pack_ID'] && x['Brand'])) {
    const plan_id = planIds.get(k['Pack_ID'])!;
    for (const pc of brandPins.get(k['Brand']) ?? []) maps.push({ pincode: pc, plan_id, is_available: true });
  }
  await prisma.pincodePlanMapping.createMany({ data: maps, skipDuplicates: true });
  return { plans: planIds.size, otts: ottIds.size, mappings: maps.length };
}

async function partnerUser(role: 'dsa' | 'tip', code: string, r: any) {
  const phone = String(r['MOBILE NO']);
  const name = [r['OWNER FIRST NAME'] ?? r['FIRST NAME'], r['OWNER LAST NAME'] ?? r['LAST NAME']].filter(Boolean).join(' ');
  const gst = r['GST NO'] ? String(r['GST NO']) : null;
  const data = {
    role, partner_code: code, name, phone, address: r['ADDRESS'], pincode: String(r['PINCODE']),
    business_name: r['TIP NAME (BSNL system)'] ?? null, gst_number: gst, gst_state_code: gst ? gst.slice(0, 2) : null,
    aadhaar_enc: r['AADHAR NO'] ? encrypt(String(r['AADHAR NO']).replace(/\s/g, ''), KEY) : null, aadhaar_last4: r['AADHAR NO'] ? last4(String(r['AADHAR NO'])) : null,
    pan_enc: r['PAN NO'] ? encrypt(String(r['PAN NO']), KEY) : null, pan_last4: r['PAN NO'] ? last4(String(r['PAN NO'])) : null,
    bank_account_enc: r['BANK ACCOUNT NO'] ? encrypt(String(r['BANK ACCOUNT NO']), KEY) : null, bank_account_last4: r['BANK ACCOUNT NO'] ? last4(String(r['BANK ACCOUNT NO'])) : null,
    partner_status: (String(r['STATUS'] ?? 'Active').toLowerCase() === 'active' ? 'approved' : 'suspended') as 'approved' | 'suspended',
    approved_at: new Date(),
  };
  return prisma.user.upsert({ where: { role_phone: { role, phone } }, update: {}, create: data });
}

async function people(indoreId: bigint) {
  const adminPhone = process.env.SEED_ADMIN_PHONE || '9999999999';
  await prisma.user.upsert({
    where: { role_phone: { role: 'admin', phone: adminPhone } }, update: {},
    create: { role: 'admin', name: 'Connect Bhai Admin', phone: adminPhone, password_hash: await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'Admin@12345', 10), city_id: indoreId },
  });
  const internal = await prisma.user.upsert({
    where: { role_phone: { role: 'tip', phone: '9000000000' } }, update: {},
    create: { role: 'tip', partner_code: 'MP09TIP000', name: 'Connect Bhai (internal)', business_name: 'Connect Bhai', phone: '9000000000', is_internal: true, partner_status: 'approved', approved_at: new Date(), city_id: indoreId, gst_state_code: '23' },
  });
  const tips = new Map<string, bigint>();
  // The 21 TIPs and 16 DSAs come from the sample sheets (fake phones/PAN). Set SEED_SAMPLE_PARTNERS=false on a live system:
  // only the admin and the internal Connect Bhai TIP are created, and real partners register through the website.
  if (process.env.SEED_SAMPLE_PARTNERS === 'false') {
    await prisma.tipPincodeMapping.createMany({ data: (await prisma.area.findMany({ distinct: ['pincode'], select: { pincode: true } })).map((a) => ({ pincode: a.pincode, tip_user_id: internal.id })), skipDuplicates: true });
    return { internal, tips, dsas: [] as bigint[], mapped: 0, unknown: [] as string[] };
  }
  const tipRows = j('tip.json').filter((r: any) => r['TIP CODE']);
  for (const r of tipRows) {
    const u = await partnerUser('tip', r['TIP CODE'], r);
    tips.set(norm(r['TIP NAME (BSNL system)']), u.id);
    const pins = String(r['SERVICE AREA PINCODES'] ?? '').split(/[,\s]+/).filter((p) => /^[1-9]\d{5}$/.test(p));
    await prisma.tipPincodeMapping.createMany({ data: pins.map((pincode) => ({ pincode, tip_user_id: u.id })), skipDuplicates: true });
  }
  const dsas: bigint[] = [];
  for (const r of j('dsa.json')) dsas.push((await partnerUser('dsa', r['DSA CODE'], r)).id);

  // real PIN -> TIP assignment sheet
  let mapped = 0, unknown = new Set<string>();
  const maps: { pincode: string; tip_user_id: bigint }[] = [];
  for (const r of j('pincode_tip.json')) {
    const pincode = String(r['Pin Code']);
    for (const raw of String(r['BSNL TIP Partner'] ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
      const id = norm(raw) === 'CONNECTBHAI' ? internal.id : tips.get(norm(raw));
      if (id) { maps.push({ pincode, tip_user_id: id }); mapped++; } else unknown.add(raw);
    }
  }
  await prisma.tipPincodeMapping.createMany({ data: maps, skipDuplicates: true });
  return { internal, tips, dsas, mapped, unknown: [...unknown] };
}

async function providerLogos() {
  for (const [name, file] of [['BSNL', 'bsnl'], ['Jio', 'jio'], ['Airtel', 'airtel']]) {
    await prisma.planCategory.updateMany({ where: { name, OR: [{ logo_url: null }, { logo_url: { startsWith: '/logos/' } }] }, data: { logo_url: `/logos/${file}.svg` } });   // never overwrite a Cloudinary URL
  }
}

async function main() {
  const prod = process.env.APP_ENV === 'production';
  if (prod && (!process.env.SEED_ADMIN_PASSWORD || process.env.SEED_ADMIN_PASSWORD === 'Admin@12345' || process.env.SEED_ADMIN_PASSWORD.length < 12)) {
    throw new Error('Refusing to seed production: set SEED_ADMIN_PASSWORD to a strong value (12+ characters, not the development default).');
  }
  await settings();
  const indore = await cities();
  const a = await areas(indore.id);
  const c = await catalogue();
  await providerLogos();
  const p = await people(indore.id);
  console.log(`seed ok: areas=${a} plans=${c.plans} otts=${c.otts} plan-pincode=${c.mappings} tips=${p.tips.size + 1} dsas=${p.dsas.length} tip-pincode=${p.mapped}`);
  if (p.unknown.length) console.log(`note: TIP names in pincode sheet with no TIP record (skipped, Connect Bhai internal TIP is the fallback): ${p.unknown.join(', ')}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
