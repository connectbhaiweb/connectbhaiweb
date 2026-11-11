import { envValidationSchema } from './env.validation';

const base = { CLOUDINARY_CLOUD_NAME: 'demo', CLOUDINARY_API_KEY: 'k', CLOUDINARY_API_SECRET: 's', DATABASE_URL: 'mysql://root@localhost:3306/x', JWT_SECRET: 'x'.repeat(32), JWT_REFRESH_SECRET: 'y'.repeat(32), DATA_ENCRYPTION_KEY: 'ab'.repeat(32) };
const run = (o: object) => envValidationSchema.validate({ ...base, ...o });

describe('env validation', () => {
  it('accepts a minimal valid env and applies defaults', () => {
    const { error, value } = run({});
    expect(error).toBeUndefined();
    expect(value.PORT).toBe(4000);
    expect(value.API_PREFIX).toBe('api/v1');
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
    // the error must NAME the problem (never the value), so a failed deploy log is readable
    expect(run({ APP_ENV: 'production', CLOUDINARY_API_SECRET: '' }).error?.message).toMatch(/CLOUDINARY_API_SECRET.*required in production/);
    expect(run({ APP_ENV: 'production', OTP_DEV_CODE: '123456' }).error?.message).toMatch(/OTP_DEV_CODE must be empty/);
    expect(run({ APP_ENV: 'production', DATA_ENCRYPTION_KEY: '0'.repeat(64) }).error?.message).toMatch(/DATA_ENCRYPTION_KEY must be set/);
    expect(run({ APP_ENV: 'production', JWT_SECRET: 'change-me-change-me-change-me' }).error?.message).toMatch(/JWT secrets must be changed/);
    expect(run({ APP_ENV: 'production' }).error).toBeUndefined();
  });
  it('rejects bad values', () => {
    expect(run({ PORT: 99999 }).error).toBeDefined();
  });
});
