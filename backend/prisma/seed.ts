/* Seeds the database from the sample Excel data (exported to prisma/seed-data/*.json) + settings + admin + demo leads.
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

/* ---------- realistic sample activity (customers, leads in every status, installs, money, tickets, chat) ----------
   Uses the REAL data above: TIPs serve their real pincodes, plans are the ones mapped to that pincode, DSAs are the 16 from the sheet.
   Deterministic (seeded generator) so every environment gets the same people; skipped if sample customers already exist. */
const FIRST = ['Aarav', 'Vivaan', 'Aditya', 'Rohan', 'Karan', 'Vikram', 'Manish', 'Pankaj', 'Rahul', 'Sandeep', 'Neha', 'Pooja', 'Priya', 'Anjali', 'Kavita', 'Sunita', 'Meena', 'Rekha', 'Shweta', 'Divya', 'Amit', 'Sachin', 'Nitin', 'Gaurav', 'Harsh', 'Yash', 'Mohit', 'Ankit', 'Deepika', 'Komal', 'Ritu', 'Seema', 'Farhan', 'Imran', 'Salman', 'Ayesha', 'Harpreet', 'Gurmeet', 'Jyoti', 'Lalita'];
const LAST = ['Sharma', 'Verma', 'Patel', 'Joshi', 'Mishra', 'Jain', 'Gupta', 'Agrawal', 'Chouhan', 'Solanki', 'Tiwari', 'Pandey', 'Yadav', 'Rathore', 'Malviya', 'Dubey', 'Soni', 'Khan', 'Qureshi', 'Singh', 'Bhatia', 'Mehta', 'Rao', 'Nair'];
const LOCALITY = ['Vijay Nagar', 'Palasia', 'Bhawarkuan', 'Sudama Nagar', 'Rajendra Nagar', 'Annapurna Road', 'Saket Nagar', 'MR-10', 'Scheme 78', 'Nipania', 'Mahalaxmi Nagar', 'Geeta Bhawan', 'Khajrana', 'LIG Colony', 'Rau'];


const nextInvoiceNo = async () => { const last = await prisma.charge.findFirst({ where: { invoice_no: { not: null } }, orderBy: { invoice_no: 'desc' }, select: { invoice_no: true } }); return last?.invoice_no ? Number(last.invoice_no.replace(/\D/g, '')) + 1 : 1; };
function rng(seed: number) { let x = seed; return () => { x = (x * 1664525 + 1013904223) % 4294967296; return x / 4294967296; }; }

async function sampleActivity(p: Awaited<ReturnType<typeof people>>) {
  if ((await prisma.user.count({ where: { role: 'customer', phone: { startsWith: '981' } } })) >= 20) return null;
  const rnd = rng(20261105), pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const fee = async (k: string, d: number) => Number((await prisma.appSetting.findUnique({ where: { key: k } }))?.value ?? d);
  const installFee = await fee('tip_install_fee', 500), onboarding = await fee('tip_onboarding_fee', 1000), payout = await fee('dsa_payout_per_lead', 300), gstPct = await fee('gst_percent', 18);
  const gst = (base: number) => { const t = Math.round(base * gstPct) / 100, half = Math.round((t / 2) * 100) / 100; return { gst_percent: gstPct, cgst_amount: half, sgst_amount: half, igst_amount: 0, total_amount: +(base + half * 2).toFixed(2) }; };
  const ago = (d: number) => new Date(Date.now() - d * 86_400_000);
  let inv = await nextInvoiceNo();
  const invoice = () => `CB-INV-${String(inv++).padStart(6, '0')}`;

  // real TIP -> pincode pairs (exclude Connect Bhai internal) and the plans available at each pincode
  const maps = await prisma.tipPincodeMapping.findMany({ where: { tip_user_id: { not: p.internal.id }, is_active: true }, select: { pincode: true, tip_user_id: true } });
  const planAt = new Map<string, bigint[]>();
  for (const m of await prisma.pincodePlanMapping.findMany({ where: { is_available: true, plan: { is_active: true, category: { type: 'fiber' } } }, select: { pincode: true, plan_id: true } })) planAt.set(m.pincode, [...(planAt.get(m.pincode) ?? []), m.plan_id]);
  const servable = maps.filter((m) => planAt.has(m.pincode));
  const tipOf = new Map((await prisma.user.findMany({ where: { role: 'tip' }, select: { id: true, name: true } })).map((t) => [t.id, t.name]));
  const geniacs = new Set(j('tip.json').filter((t: any) => t['GENIEACS (TR-069)'] === 'Y').map((t: any) => String(t['MOBILE NO'])));
  const geniacsTips = new Set((await prisma.user.findMany({ where: { role: 'tip', phone: { in: [...geniacs] as string[] } }, select: { id: true } })).map((t) => t.id));

  // statuses: a realistic funnel
  const plan: string[] = [...Array(10).fill('new'), ...Array(8).fill('contacted'), ...Array(7).fill('followup'), ...Array(6).fill('scheduled'), ...Array(22).fill('installed'), ...Array(4).fill('lost'), ...Array(3).fill('cancelled')];
  const stats: Record<string, number> = { customers: 0, leads: 0, installed: 0, charges: 0, tickets: 0, messages: 0 };
  let serial = 100, tk = (await prisma.ticket.count()) + 1;
  const names = new Set<string>();

  for (let i = 0; i < plan.length; i++) {
    const status = plan[i];
    let name = ''; do { name = `${pick(FIRST)} ${pick(LAST)}`; } while (names.has(name)); names.add(name);
    const phone = `981${String(1000000 + i * 7919 % 9000000).padStart(7, '0')}`.slice(0, 10);
    const customer = await prisma.user.upsert({ where: { role_phone: { role: 'customer', phone } }, update: {}, create: { role: 'customer', phone, name, email: `${name.toLowerCase().replace(' ', '.')}${i}@example.in`, address: undefined } });
    stats.customers++;
    const m = pick(servable), tipId = m.tip_user_id, planId = pick(planAt.get(m.pincode)!);
    const byDsa = rnd() < 0.6, dsaId = byDsa ? pick(p.dsas) : null;
    const created = ago(status === 'installed' ? 20 + Math.floor(rnd() * 40) : Math.floor(rnd() * 14));
    const addr = `${1 + Math.floor(rnd() * 200)}, ${pick(LOCALITY)}, Indore`;
    const data: any = { ref_code: `TMP-S-${i}-${Date.now() % 100000}`, source: byDsa ? 'dsa' : pick(['website', 'callback']), customer_user_id: customer.id, customer_name: name, customer_phone: phone, customer_email: `${name.toLowerCase().replace(' ', '.')}${i}@example.in`, address: addr, pincode: m.pincode,
      plan_id: planId, brought_by_user_id: dsaId, tip_user_id: tipId, status, created_at: created, updated_at: created };
    if (status === 'followup') data.followup_at = ago(-1 - Math.floor(rnd() * 4));
    if (status === 'lost') data.lost_reason = pick(['Customer not interested', 'Already has a connection', 'Not reachable']);
    if (status === 'cancelled') data.lost_reason = 'Customer cancelled the booking';
    const lead = await prisma.lead.create({ data });
    const ref = `CB-${String(lead.id).padStart(6, '0')}`;
    await prisma.lead.update({ where: { id: lead.id }, data: { ref_code: ref } });
    stats.leads++;
    await prisma.leadEvent.create({ data: { lead_id: lead.id, event_type: 'created', to_status: 'new', note: `source=${data.source}`, created_at: created } });
    await prisma.leadEvent.create({ data: { lead_id: lead.id, event_type: 'assigned', note: `tip=${tipOf.get(tipId)}`, created_at: created } });
    if (status !== 'new') await prisma.leadEvent.create({ data: { lead_id: lead.id, event_type: 'status_changed', from_status: 'new', to_status: status === 'scheduled' || status === 'installed' ? 'contacted' : status, note: 'Called the customer', created_at: new Date(created.getTime() + 3_600_000) } });

    if (status === 'scheduled' || status === 'installed' || status === 'cancelled') {
      const when = new Date(created.getTime() + 3 * 86_400_000);
      const done = status === 'installed';
      const b = await prisma.booking.create({ data: { lead_id: lead.id, tip_user_id: tipId, scheduled_at: status === 'scheduled' ? ago(-1 - Math.floor(rnd() * 3)) : when, status: done ? 'completed' : status === 'cancelled' ? 'cancelled' : 'scheduled',
        completed_at: done ? when : undefined, connection_id: done ? `BSNL-FTTH-${String(++serial).padStart(5, '0')}` : undefined, router_serial: done ? `SN${20260000 + serial}` : undefined } });
      if (done) {
        stats.installed++;
        const careOn = geniacsTips.has(tipId) && rnd() < 0.7;
        await prisma.lead.update({ where: { id: lead.id }, data: { installed_at: when, care_plan: careOn, care_plan_at: careOn ? when : null } });
        await prisma.leadEvent.create({ data: { lead_id: lead.id, event_type: 'status_changed', from_status: 'scheduled', to_status: 'installed', note: 'Installed', created_at: when } });
        if (careOn) await prisma.carePlanDevice.create({ data: { lead_id: lead.id, tip_user_id: tipId, serial_number: `SN${20260000 + serial}`, model: pick(['Syrotech SY-GPON-1110', 'Tenda HG6', 'Netlink HG323']), genieacs_device_id: `dev-${serial}`, online: rnd() < 0.85, last_seen_at: ago(rnd()), rx_power_dbm: -(17 + rnd() * 6), wifi_ssid: `${name.split(' ')[0]}_WiFi`, connected_clients: 1 + Math.floor(rnd() * 8) } });
        if (dsaId) { const r = rnd(), st = r < 0.4 ? 'paid' : r < 0.7 ? 'approved' : 'pending';
          await prisma.commission.create({ data: { dsa_user_id: dsaId, lead_id: lead.id, booking_id: b.id, amount: payout, status: st as any, approved_at: st !== 'pending' ? ago(5) : undefined, paid_at: st === 'paid' ? ago(2) : undefined, paid_mode: st === 'paid' ? 'upi' : undefined, paid_reference: st === 'paid' ? `UTR${String(98000000 + i)}` : undefined } }); }
        const paid = rnd() < 0.55;
        await prisma.charge.create({ data: { kind: 'tip_install_fee', payer_user_id: tipId, lead_id: lead.id, description: `Install fee · ${ref} · ${name}`, base_amount: installFee, ...gst(installFee), status: paid ? 'paid' : 'pending',
          pay_mode: paid ? (rnd() < 0.5 ? 'razorpay' : 'offline') : undefined, razorpay_payment_id: paid ? `pay_seed_${i}` : undefined, offline_reference: paid ? `NEFT-${700000 + i}` : undefined, paid_at: paid ? ago(1 + Math.floor(rnd() * 10)) : undefined, invoice_no: paid ? invoice() : undefined, install_fee_key: lead.id } });
        stats.charges++;
        if (i % 2 === 0) {   // the customer's own payment (router rental / installation), GST-inclusive
          const total = pick([236, 590, 944, 1180]), base = +(total / (1 + gstPct / 100)).toFixed(2), half = +(((total - base) / 2)).toFixed(2), cpaid = rnd() < 0.6;
          await prisma.charge.create({ data: { kind: 'customer_payment', payer_user_id: customer.id, lead_id: lead.id, description: pick(['Router rental', 'Installation charge', 'Monthly bill']) + ` · ${ref}`, base_amount: base, gst_percent: gstPct, cgst_amount: half, sgst_amount: half, igst_amount: 0, total_amount: total,
            status: cpaid ? 'paid' : 'pending', pay_mode: cpaid ? 'razorpay' : undefined, razorpay_payment_id: cpaid ? `pay_seed_c${i}` : undefined, paid_at: cpaid ? ago(1 + Math.floor(rnd() * 15)) : undefined, invoice_no: cpaid ? invoice() : undefined } });
          stats.charges++;
        }
      }
    }
    // support tickets on some installed connections
    if (status === 'installed' && i % 3 === 0) {
      const st = pick(['open', 'in_progress', 'resolved', 'closed']);
      await prisma.ticket.create({ data: { ticket_code: `TK-${String(tk++).padStart(6, '0')}`, lead_id: lead.id, raised_by: customer.id, assigned_to: tipId, category: pick(['no_internet', 'slow_speed', 'billing', 'other']), subject: pick(['Internet not working since morning', 'Speed is very slow at night', 'Wrong amount in bill', 'Need Wi-Fi password change']),
        description: 'Please check and call me.', priority: pick(['low', 'normal', 'high']), status: st as any, resolved_at: st === 'resolved' || st === 'closed' ? ago(1) : undefined, created_at: ago(2 + Math.floor(rnd() * 8)) } });
      stats.tickets++;
    }
    // chat on some leads: customer <-> TIP, plus a support question
    if (i % 4 === 0 && status !== 'new') {
      const lines: [bigint, string][] = [[tipId, `Namaste ${name.split(' ')[0]}, this is ${tipOf.get(tipId)}. I will arrange your installation.`], [customer.id, 'Thank you. Please come in the evening.'], [tipId, 'Sure, we will confirm the time on call.']];
      for (let k = 0; k < lines.length; k++) await prisma.chatMessage.create({ data: { thread_type: 'lead', thread_id: lead.id, sender_user_id: lines[k][0], body: lines[k][1], created_at: new Date(created.getTime() + (k + 1) * 600_000) } });
      stats.messages += lines.length;
    }
    if (i % 9 === 0) { await prisma.chatMessage.create({ data: { thread_type: 'support', thread_id: customer.id, sender_user_id: customer.id, body: 'Hi, when will my connection be activated?' } }); stats.messages++; }
  }
  // each approved TIP paid the onboarding charge once (with GST invoice)
  if ((await prisma.charge.count({ where: { kind: 'tip_onboarding' } })) === 0) {
    for (const [tipId] of tipOf) { if (tipId === p.internal.id) continue;
      await prisma.charge.create({ data: { kind: 'tip_onboarding', payer_user_id: tipId, description: 'TIP onboarding charge', base_amount: onboarding, ...gst(onboarding), status: 'paid', pay_mode: 'razorpay', razorpay_payment_id: `pay_seed_onb_${tipId}`, paid_at: ago(60), invoice_no: invoice() } });
      stats.charges++; }
  }
  return stats;
}

/* Idempotent: every lead belongs to its customer account (matched by phone) and installed customers have a payment of their own. */
async function linkCustomersAndPayments() {
  const leads = await prisma.lead.findMany({ where: { customer_phone: { startsWith: '981' } }, orderBy: { id: 'asc' } });
  const gstPct = Number((await prisma.appSetting.findUnique({ where: { key: 'gst_percent' } }))?.value ?? 18);
  let inv = await nextInvoiceNo(), linked = 0, pays = 0;
  for (const [i, l] of leads.entries()) {
    const cust = await prisma.user.findUnique({ where: { role_phone: { role: 'customer', phone: l.customer_phone } } });
    if (!cust) continue;
    if (!l.customer_user_id || !l.customer_email) {
      await prisma.lead.update({ where: { id: l.id }, data: { customer_user_id: cust.id, customer_email: l.customer_email ?? cust.email ?? undefined } }); linked++;
    }
    if (l.status === 'installed' && i % 2 === 0 && !(await prisma.charge.count({ where: { lead_id: l.id, kind: 'customer_payment' } }))) {
      const total = [236, 590, 944, 1180][i % 4], base = +(total / (1 + gstPct / 100)).toFixed(2), half = +((total - base) / 2).toFixed(2), paid = i % 5 !== 0;
      await prisma.charge.create({ data: { kind: 'customer_payment', payer_user_id: cust.id, lead_id: l.id, description: ['Router rental', 'Installation charge', 'Monthly bill'][i % 3] + ` · ${l.ref_code}`, base_amount: base, gst_percent: gstPct, cgst_amount: half, sgst_amount: half, igst_amount: 0, total_amount: total,
        status: paid ? 'paid' : 'pending', pay_mode: paid ? 'razorpay' : undefined, razorpay_payment_id: paid ? `pay_seed_c${l.id}` : undefined, paid_at: paid ? new Date(Date.now() - (1 + i % 12) * 86_400_000) : undefined, invoice_no: paid ? `CB-INV-${String(inv++).padStart(6, '0')}` : undefined } });
      pays++;
    }
  }
  return { linked, customer_payments: pays };
}

/** Provider logos: local /logos/*.svg until `npm run logos:upload` moves them to Cloudinary (then those URLs are kept). */
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
  // Demo customers, leads, payments, tickets and chat are for development only. Production gets the real reference data and the admin login.
  const withSample = (process.env.SEED_SAMPLE_DATA ?? (prod ? 'false' : 'true')) !== 'false';
  await settings();
  const indore = await cities();
  const a = await areas(indore.id);
  const c = await catalogue();
  await providerLogos();
  const p = await people(indore.id);
  const sample = withSample ? await sampleActivity(p) : null;
  if (withSample) console.log('customers linked:', JSON.stringify(await linkCustomersAndPayments()));
  else console.log('sample customers/leads skipped (SEED_SAMPLE_DATA=false)');
  console.log(`seed ok: areas=${a} plans=${c.plans} otts=${c.otts} plan-pincode=${c.mappings} tips=${p.tips.size + 1} dsas=${p.dsas.length} tip-pincode=${p.mapped}`);
  if (sample) console.log('sample activity:', JSON.stringify(sample));
  if (p.unknown.length) console.log(`note: TIP names in pincode sheet with no TIP record (skipped, Connect Bhai internal TIP is the fallback): ${p.unknown.join(', ')}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
