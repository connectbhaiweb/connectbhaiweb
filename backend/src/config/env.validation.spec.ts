import { envValidationSchema } from './env.validation';

const base = { CLOUDINARY_CLOUD_NAME: 'demo', CLOUDINARY_API_KEY: 'k', CLOUDINARY_API_SECRET: 's', DATABASE_URL: 'mysql://root@localhost:3306/x', JWT_SECRET: 'x'.repeat(32), JWT_REFRESH_SECRET: 'y'.repeat(32), DATA_ENCRYPTION_KEY: 'ab'.repeat(32) };
const run = (o: object) => envValidationSchema.validate({ ...base, ...o });

describe('env validation', () => {
  it('accepts a minimal valid env and applies defaults', () => {
    const { error, value } = run({});
    expect(error).toBeUndefined();
    expect(value.PORT).toBe(4000);
    expect(value.API_PREFIX).toBe('api/v1');
    expect(value.GST_PERCENT).toBe(18);
  });
  it('requires DATABASE_URL, secrets and encryption key', () => {
    expect(envValidationSchema.validate({}).error).toBeDefined();
    expect(run({ DATABASE_URL: 'postgres://x' }).error).toBeDefined();
    expect(run({ DATA_ENCRYPTION_KEY: 'short' }).error).toBeDefined();
    expect(run({ JWT_SECRET: 'tiny' }).error).toBeDefined();
  });
  it('production refuses placeholder secrets, zero key and dev OTP', () => {
    expect(run({ APP_ENV: 'production', JWT_SECRET: 'change-me-change-me-change-me' }).error).toBeDefined();
    expect(run({ APP_ENV: 'production', DATA_ENCRYPTION_KEY: '0'.repeat(64) }).error).toBeDefined();
    expect(run({ APP_ENV: 'production', OTP_DEV_CODE: '123456' }).error).toBeDefined();
    expect(run({ APP_ENV: 'production', CLOUDINARY_API_SECRET: '' }).error).toBeDefined();   // uploads must be configured in production
    expect(run({ APP_ENV: 'production' }).error).toBeUndefined();
  });
  it('rejects bad values', () => {
    expect(run({ PORT: 99999 }).error).toBeDefined();
    expect(run({ GST_PERCENT: 150 }).error).toBeDefined();
    expect(run({ TIP_INSTALL_FEE: -1 }).error).toBeDefined();
  });
});
