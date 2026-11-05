import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { actors, bearer, createCtx, Ctx, P, uniquePhone } from './helpers';
import { UploadsService } from '../src/uploads/uploads.service';

const sha1 = (s: string) => createHash('sha1').update(s).digest('hex');
const SECRET = 'test-cloud-secret';
const asset = (folder = 'connectbhai/kyc', id = Math.random().toString(36).slice(2), version = 1730000000, secret = SECRET) =>
  ({ public_id: `${folder}/${id}`, version, signature: sha1(`public_id=${folder}/${id}&version=${version}${secret}`), format: 'pdf', resource_type: 'image', bytes: 12345 });
const partnerBody = (phone: string, docs?: any, role: 'dsa' | 'tip' = 'dsa') => ({
  role, name: 'Doc Tester', phone, email: 'doc@example.in', address: '12 Test Street, Indore', pincode: '452010', business_name: role === 'tip' ? 'Doc Net' : undefined,
  aadhaar: '123412341234', pan: 'ABCDE1234F', bank_name: 'SBI', bank_account: '123456789012', bank_ifsc: 'SBIN0001234', documents: docs,
});

describe('uploads: Cloudinary configured', () => {
  let c: Ctx; let a: Awaited<ReturnType<typeof actors>>;
  beforeAll(async () => {
    c = await createCtx((b) => b.overrideProvider(UploadsService).useValue(new UploadsService({ get: (k: string) => ({ CLOUDINARY_CLOUD_NAME: 'democloud', CLOUDINARY_API_KEY: 'key123', CLOUDINARY_API_SECRET: SECRET, UPLOAD_MAX_MB: 5 } as any)[k] } as unknown as ConfigService)));
    a = await actors(c);
  });
  afterAll(() => c.app.close());

  describe('POST /uploads/sign', () => {
    it('KYC can be signed without login; the secret is never returned', async () => {
      const r = await c.http().post(`${P}/uploads/sign`).send({ purpose: 'kyc' }).expect(201);
      expect(r.body).toMatchObject({ cloud_name: 'democloud', folder: 'connectbhai/kyc', type: 'authenticated' });
      expect(JSON.stringify(r.body)).not.toContain(SECRET);
    });
    it.each([['ticket', 'dsa1', 201], ['chat', 'dream', 201], ['logo', 'admin', 201], ['logo', 'dsa1', 403], ['logo', 'dream', 403], ['sheet', 'dream', 201], ['sheet', 'dsa1', 403], ['sheet', 'admin', 201]])(
      '%s as %s -> %i', async (purpose, who, code) => {
        await c.http().post(`${P}/uploads/sign`).set(bearer((a as any)[who])).send({ purpose }).expect(code);
      });
    it('login is required for non-KYC purposes; unknown purposes and missing bodies are 400', async () => {
      await c.http().post(`${P}/uploads/sign`).send({ purpose: 'ticket' }).expect(403);
      await c.http().post(`${P}/uploads/sign`).send({ purpose: 'passwords' }).expect(400);
      await c.http().post(`${P}/uploads/sign`).send({}).expect(400);
    });
  });

  describe('partner registration with KYC documents', () => {
    const docs = () => ({ aadhaar: asset(), pan: asset(), bank_proof: asset() });
    it('accepts genuine uploads and stores references (not URLs)', async () => {
      const phone = uniquePhone();
      const r = await c.http().post(`${P}/partners/register`).send(partnerBody(phone, docs())).expect(201);
      const row = await c.prisma.user.findUniqueOrThrow({ where: { id: r.body.user.id } });
      expect(Object.keys(row.docs as any).sort()).toEqual(['aadhaar', 'bank_proof', 'pan']);
      expect(JSON.stringify(row.docs)).not.toMatch(/https?:/);
    });
    it('requires all three documents when uploads are configured', async () => {
      await c.http().post(`${P}/partners/register`).send(partnerBody(uniquePhone())).expect(400);
      const d = docs(); delete (d as any).pan;
      const r = await c.http().post(`${P}/partners/register`).send(partnerBody(uniquePhone(), d)).expect(400);
      expect(JSON.stringify(r.body)).toMatch(/PAN/);
    });
    it('rejects forged signatures, other folders and a file signed with the wrong secret', async () => {
      const bad = [
        { ...docs(), aadhaar: { ...asset(), signature: 'a'.repeat(40) } },
        { ...docs(), pan: asset('connectbhai/chat') },                           // a chat file passed off as KYC
        { ...docs(), bank_proof: asset('connectbhai/kyc', 'x', 1, 'another-secret') },
        { ...docs(), aadhaar: { ...asset(), version: 2 } },                      // tampered version
      ];
      for (const documents of bad) await c.http().post(`${P}/partners/register`).send(partnerBody(uniquePhone(), documents)).expect(400);
    });
    it('malformed document objects are rejected by validation', async () => {
      await c.http().post(`${P}/partners/register`).send(partnerBody(uniquePhone(), { aadhaar: { public_id: 5 }, pan: asset(), bank_proof: asset() })).expect(400);
    });
  });

  describe('GET /users/:id/documents (admin review)', () => {
    it('admin gets expiring signed links; everyone else is refused', async () => {
      const r = await c.http().post(`${P}/partners/register`).send(partnerBody(uniquePhone(), { aadhaar: asset(), pan: asset(), bank_proof: asset() }, 'tip')).expect(201);
      const id = r.body.user.id;
      const docs = await c.http().get(`${P}/users/${id}/documents`).set(bearer(a.admin)).expect(200);
      expect(docs.body.configured).toBe(true);
      expect(docs.body.documents.map((d: any) => d.label)).toEqual(['Aadhaar', 'PAN card', 'Bank proof']);
      for (const d of docs.body.documents) {
        const u = new URL(d.url);
        expect(u.origin).toBe('https://api.cloudinary.com');
        expect(u.searchParams.get('type')).toBe('authenticated');
        expect(Number(u.searchParams.get('expires_at'))).toBeGreaterThan(Math.floor(Date.now() / 1000));
        expect(u.searchParams.get('signature')).toMatch(/^[0-9a-f]{40}$/);
        expect(d.url).not.toContain(SECRET);
      }
      await c.http().get(`${P}/users/${id}/documents`).expect(401);
      await c.http().get(`${P}/users/${id}/documents`).set(bearer(a.dsa1)).expect(403);
      await c.http().get(`${P}/users/${id}/documents`).set(bearer(a.dream)).expect(403);
      await c.http().get(`${P}/users/99999999/documents`).set(bearer(a.admin)).expect(404);
    });
  });
});

describe('uploads: Cloudinary NOT configured (local development)', () => {
  let c: Ctx; let a: Awaited<ReturnType<typeof actors>>;
  beforeAll(async () => { c = await createCtx(); a = await actors(c); });
  afterAll(() => c.app.close());
  it('signing says 503 clearly instead of failing later', async () => {
    const r = await c.http().post(`${P}/uploads/sign`).send({ purpose: 'kyc' }).expect(503);
    expect(JSON.stringify(r.body)).toMatch(/not configured/i);
  });
  it('partner registration still works without documents, and the documents list is empty', async () => {
    const r = await c.http().post(`${P}/partners/register`).send(partnerBody(uniquePhone())).expect(201);
    const d = await c.http().get(`${P}/users/${r.body.user.id}/documents`).set(bearer(a.admin)).expect(200);
    expect(d.body).toEqual({ configured: false, documents: [] });
  });
});
