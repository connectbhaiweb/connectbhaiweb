import { of, lastValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { AssetUrlInterceptor } from '../interceptors/asset-url.interceptor';
import { assetUrl } from './asset-url';

describe('assetUrl', () => {
  it('builds the full URL from the stored Cloudinary path, the cloud name and the delivery host', () => {
    expect(assetUrl('v1/connectbhai/logos/bsnl.svg', 'democloud')).toBe('https://res.cloudinary.com/democloud/image/upload/v1/connectbhai/logos/bsnl.svg');
    expect(assetUrl('connectbhai/logos/jio.svg', 'democloud', 'https://cdn.example.in/')).toBe('https://cdn.example.in/democloud/image/upload/connectbhai/logos/jio.svg');   // custom domain from env
    expect(assetUrl('/connectbhai/x.svg', 'democloud')).toBe('/connectbhai/x.svg');           // site-relative paths are left alone
  });
  it('leaves full URLs, site paths and empty values untouched, and does nothing without a cloud name', () => {
    for (const v of ['https://res.cloudinary.com/x/image/upload/a.svg', 'http://a/b.png', '//cdn/a.png', '/logos/bsnl.svg', '']) expect(assetUrl(v, 'democloud')).toBe(v);
    expect(assetUrl('v1/a.svg', '')).toBe('v1/a.svg');
  });
});

describe('AssetUrlInterceptor', () => {
  const run = (body: any, env: Record<string, string> = { CLOUDINARY_CLOUD_NAME: 'democloud' }) =>
    lastValueFrom(new AssetUrlInterceptor({ get: (k: string) => env[k] } as unknown as ConfigService).intercept({} as any, { handle: () => of(body) }));
  it('rewrites logo_url anywhere in a nested response (lists, objects) and nothing else', async () => {
    const date = new Date();
    const out = await run({ items: [{ id: 1, name: 'v1/keep-me.svg', created_at: date, category: { logo_url: 'v1/connectbhai/logos/bsnl.svg' } }, { category: { logo_url: null } }], total: 2 });
    expect(out.items[0].category.logo_url).toBe('https://res.cloudinary.com/democloud/image/upload/v1/connectbhai/logos/bsnl.svg');
    expect(out.items[0].name).toBe('v1/keep-me.svg');
    expect(out.items[0].created_at).toBe(date);
    expect(out.items[1].category.logo_url).toBeNull();
    expect(out.total).toBe(2);
  });
  it('honours CLOUDINARY_DELIVERY_URL and leaves paths alone when Cloudinary is not configured', async () => {
    expect((await run({ logo_url: 'v1/a.svg' }, { CLOUDINARY_CLOUD_NAME: 'c', CLOUDINARY_DELIVERY_URL: 'https://img.connectbhai.in' })).logo_url).toBe('https://img.connectbhai.in/c/image/upload/v1/a.svg');
    expect((await run({ logo_url: 'v1/a.svg' }, {})).logo_url).toBe('v1/a.svg');
  });
  it('passes arrays, strings and null bodies through', async () => {
    expect(await run([1, 'x', null])).toEqual([1, 'x', null]);
    expect(await run(null)).toBeNull();
  });
});
