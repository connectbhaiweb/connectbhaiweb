import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });
if (!process.env.DATABASE_URL?.includes('_test')) throw new Error('e2e tests must run against a *_test database');
