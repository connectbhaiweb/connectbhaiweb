import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { PURPOSES, signParams, UploadsService } from './uploads.service';

const cfg = (o: Record<string, any> = {}) => ({ get: (k: string) => ({ CLOUDINARY_CLOUD_NAME: 'democloud', CLOUDINARY_API_KEY: 'key123', CLOUDINARY_API_SECRET: 'sec456', UPLOAD_MAX_MB: 5, ...o })[k] }) as unknown as ConfigService;
const sha1 = (s: string) => createHash('sha1').update(s).digest('hex');
const admin = { id: 1, role: 'admin', phone: '9999999999' } as any, tip = { id: 2, role: 'tip', phone: '9100000001' } as any, cust = { id: 3, role: 'customer', phone: '9811111111' } as any;

describe('signParams (Cloudinary signing)', () => {
  it('is SHA-1 of the sorted k=v pairs joined with & plus the API secret', () => {
    const sig = signParams({ timestamp: 1315060510, public_id: 'sample_image', eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop' }, 'abcd');
    expect(sig).toBe(sha1('eager=w_400,h_300,c_pad|w_260,h_200,c_crop&public_id=sample_image&timestamp=1315060510' + 'abcd'));
    expect(sig).toMatch(/^[0-9a-f]{40}$/);
  });
  it('is independent of key order and ignores empty values', () => {
    expect(signParams({ b: 2, a: 1 }, 's')).toBe(signParams({ a: 1, b: 2, c: '' }, 's'));
  });
});

describe('UploadsService.sign', () => {
  const s = new UploadsService(cfg());
  it('signs the folder, type, formats and timestamp for KYC, without login, as a private (authenticated) asset', () => {
    const r = s.sign('kyc');
    expect(r).toMatchObject({ cloud_name: 'democloud', api_key: 'key123', folder: 'connectbhai/kyc', type: 'authenticated', allowed_formats: 'jpg,jpeg,png,pdf', max_bytes: 5 * 1024 * 1024 });
    expect(r.signature).toBe(sha1(`allowed_formats=jpg,jpeg,png,pdf&folder=connectbhai/kyc&timestamp=${r.timestamp}&type=authenticated` + 'sec456'));
    expect(JSON.stringify(r)).not.toContain('sec456');                 // the secret never leaves the server
    expect(r.upload_url).toBe('https://api.cloudinary.com/v1_1/democloud/auto/upload');
  });
  it('enforces who may upload what', () => {
    expect(() => s.sign('ticket')).toThrow(/Log in/);                   // anonymous
    expect(() => s.sign('chat', cust)).not.toThrow();
    expect(() => s.sign('logo', cust)).toThrow(/Only admin/);
    expect(() => s.sign('logo', tip)).toThrow(/Only admin/);
    expect(() => s.sign('logo', admin)).not.toThrow();
    expect(() => s.sign('sheet', tip)).not.toThrow();
    expect(() => s.sign('sheet', cust)).toThrow(/admin or TIP/);
    expect(() => s.sign('nope' as any, admin)).toThrow(/Unknown/);
  });
  it('only logos are public; every personal document type is authenticated', () => {
    expect(Object.entries(PURPOSES).filter(([, r]) => r.type === 'upload').map(([k]) => k)).toEqual(['logo']);
  });
  it('takes the Cloudinary API host from env (CLOUDINARY_API_URL) for both uploads and downloads', () => {
    const custom = new UploadsService(cfg({ CLOUDINARY_API_URL: 'https://api-proxy.connectbhai.in/v1_1/' }));
    expect(custom.sign('kyc').upload_url).toBe('https://api-proxy.connectbhai.in/v1_1/democloud/auto/upload');
    expect(custom.downloadUrl({ public_id: 'connectbhai/kyc/a', format: 'pdf' })).toMatch(/^https:\/\/api-proxy\.connectbhai\.in\/v1_1\/democloud\/image\/download\?/);
  });
  it('refuses to sign when Cloudinary is not configured', () => {
    expect(() => new UploadsService(cfg({ CLOUDINARY_API_SECRET: '' })).sign('kyc')).toThrow(/not configured/);
    expect(new UploadsService(cfg({ CLOUDINARY_CLOUD_NAME: '' })).configured).toBe(false);
  });
});

describe('UploadsService.verifyAsset', () => {
  const s = new UploadsService(cfg());
  const good = { public_id: 'connectbhai/kyc/abc', version: 1730000000 };
  const asset = { ...good, signature: sha1(`public_id=${good.public_id}&version=${good.version}sec456`) };
  it('accepts a genuine Cloudinary response for the right folder', () => expect(s.verifyAsset('kyc', asset)).toBe(true));
  it('rejects forged, tampered, wrong-folder and empty input', () => {
    expect(s.verifyAsset('kyc', { ...asset, signature: 'f'.repeat(40) })).toBe(false);
    expect(s.verifyAsset('kyc', { ...asset, version: 1 })).toBe(false);                                   // tampered version
    expect(s.verifyAsset('kyc', { ...asset, public_id: 'connectbhai/kyc/other' })).toBe(false);          // tampered id
    expect(s.verifyAsset('chat', asset)).toBe(false);                                                    // KYC file used as a chat file
    expect(s.verifyAsset('kyc', { ...asset, public_id: 'someone-elses/file', signature: sha1(`public_id=someone-elses/file&version=${good.version}sec456`) })).toBe(false);
    expect(s.verifyAsset('kyc', undefined as any)).toBe(false);
    expect(new UploadsService(cfg({ CLOUDINARY_API_SECRET: '' })).verifyAsset('kyc', asset)).toBe(false);
  });
});

describe('UploadsService.downloadUrl', () => {
  const s = new UploadsService(cfg());
  it('builds an expiring, signed private-download link', () => {
    const u = new URL(s.downloadUrl({ public_id: 'connectbhai/kyc/abc', format: 'pdf', resource_type: 'image' }, 600));
    expect(u.origin + u.pathname).toBe('https://api.cloudinary.com/v1_1/democloud/image/download');
    const q = Object.fromEntries(u.searchParams);
    expect(q).toMatchObject({ public_id: 'connectbhai/kyc/abc', format: 'pdf', type: 'authenticated', api_key: 'key123' });
    expect(Number(q.expires_at) - Number(q.timestamp)).toBe(600);
    const { signature, api_key, ...signed } = q;
    expect(signature).toBe(signParams(signed, 'sec456'));
    expect(u.toString()).not.toContain('sec456');
  });
});
