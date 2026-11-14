import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { hmacSha256 } from '../src/common/utils/crypto';

export const P = '/api/v1';
export const ADMIN_PHONE = '9999999999';
export const INTERNAL_TIP_PHONE = '9000000000';
export const DSA1_PHONE = '9000000001';
export const DSA2_PHONE = '9000000002';
export const DREAM_PHONE = '9100000001'; // TIP "DREAM", serves 452010 / 452008 / 452018
export const DOULAT_PHONE = '9100000002'; // another TIP
export const PIN = '452010';
export const PLAN_CODE = 'BSNL-01'; // available in 452010

export interface Ctx { app: INestApplication; prisma: PrismaService; jwt: JwtService; http: () => ReturnType<typeof request> }

export async function createCtx(override?: (b: TestingModuleBuilder) => TestingModuleBuilder): Promise<Ctx> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (override) builder = override(builder);
  const mod = await builder.compile();
  const app = mod.createNestApplication<NestExpressApplication>({ rawBody: true, logger: false });
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService), jwt: app.get(JwtService), http: () => request(app.getHttpServer()) };
}

export async function tokenFor(c: Ctx, role: UserRole, phone: string, type: 'access' | 'refresh' = 'access') {
  const u = await c.prisma.user.findUniqueOrThrow({ where: { role_phone: { role, phone } } });
  const secret = type === 'access' ? process.env.JWT_SECRET : process.env.JWT_REFRESH_SECRET;
  return c.jwt.signAsync({ sub: Number(u.id), role, phone, typ: type }, { secret, expiresIn: '10m' });
}
export const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

let n = 0;
export const uniquePhone = () => `9${String(Date.now()).slice(-6)}${String(Math.floor(Math.random() * 90) + 10)}${(n++ % 10)}`.slice(0, 10);

export async function makeCustomer(c: Ctx, name = 'Test Customer') {
  const phone = uniquePhone();
  const user = await c.prisma.user.create({ data: { role: 'customer', name, phone } });
  return { user, phone, token: await tokenFor(c, 'customer', phone) };
}
export async function actors(c: Ctx) {
  const [admin, dsa1, dsa2, dream, doulat, internal] = await Promise.all([
    tokenFor(c, 'admin', ADMIN_PHONE), tokenFor(c, 'dsa', DSA1_PHONE), tokenFor(c, 'dsa', DSA2_PHONE),
    tokenFor(c, 'tip', DREAM_PHONE), tokenFor(c, 'tip', DOULAT_PHONE), tokenFor(c, 'tip', INTERNAL_TIP_PHONE),
  ]);
  const id = async (role: UserRole, phone: string) => Number((await c.prisma.user.findUniqueOrThrow({ where: { role_phone: { role, phone } } })).id);
  return {
    admin, dsa1, dsa2, dream, doulat, internal,
    ids: { dsa1: await id('dsa', DSA1_PHONE), dsa2: await id('dsa', DSA2_PHONE), dream: await id('tip', DREAM_PHONE), doulat: await id('tip', DOULAT_PHONE), internal: await id('tip', INTERNAL_TIP_PHONE) },
  };
}

/**
 * Creates a lead and returns its body. A DSA's own lead stays theirs; a website lead goes to the DSA serving the PIN code (auto-assign).
 *  - tip:   puts the lead with that TIP before it is booked. That is the old-flow state (still valid for leads already with a TIP):
 *           the TIP can contact, follow up and book it. In the new flow a TIP is assigned only after the DSA has booked the lead.
 *  - noDsa: clears the DSA, a lead no DSA serves (it waits for admin).
 */
export async function newLead(c: Ctx, a: Awaited<ReturnType<typeof actors>>, o: { by?: 'dsa1' | 'dsa2' | 'web'; tip?: 'dream' | 'doulat' | 'internal'; noDsa?: boolean } = {}) {
  const by = o.by ?? 'dsa1';
  const req = c.http().post(`${P}/leads`);
  if (by !== 'web') req.set(bearer(a[by]));
  const res = await req.send({ customer_name: 'Lead Person', customer_phone: uniquePhone(), pincode: PIN, plan_id: await planId(c) });
  if (res.status !== 201) throw new Error(`lead create failed: ${res.status} ${JSON.stringify(res.body)}`);
  const lead = res.body;
  if (!o.tip && !o.noDsa) return lead;
  await c.prisma.lead.update({ where: { id: lead.id }, data: { ...(o.tip ? { tip_user_id: a.ids[o.tip] } : {}), ...(o.noDsa ? { brought_by_user_id: null } : {}) } });
  const r = await c.http().get(`${P}/leads/${lead.id}`).set(bearer(a.admin));
  if (r.status !== 200) throw new Error(`lead read failed ${JSON.stringify(r.body)}`);
  return r.body;
}
export const planId = async (c: Ctx, code = PLAN_CODE) => Number((await c.prisma.plan.findUniqueOrThrow({ where: { plan_code: code } })).id);
export const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

/** Books + completes an installation. */
export async function install(c: Ctx, tipToken: string, leadId: number, router = `SN-${Date.now()}-${Math.floor(Math.random() * 1e4)}`) {
  const b = await c.http().post(`${P}/bookings`).set(bearer(tipToken)).send({ lead_id: leadId, scheduled_at: inDays(1) });
  if (b.status !== 201) throw new Error(`booking failed ${JSON.stringify(b.body)}`);
  const done = await c.http().post(`${P}/bookings/${b.body.id}/complete`).set(bearer(tipToken)).send({ connection_id: 'CID-1', router_serial: router });
  if (done.status !== 200) throw new Error(`complete failed ${JSON.stringify(done.body)}`);
  return { booking: b.body, result: done.body };
}
export const rzpSig = (orderId: string, paymentId: string) => hmacSha256(process.env.RAZORPAY_KEY_SECRET || 'mock-secret', `${orderId}|${paymentId}`);
