import { ServiceUnavailableException } from '@nestjs/common';
import { hmacSha256 } from '../common/utils/crypto';
import { RazorpayService } from './razorpay.service';

const svc = (env: Record<string, string>) => new RazorpayService({ get: (k: string) => env[k] } as any);

describe('RazorpayService', () => {
  it('mock mode creates a local order in paise', async () => {
    const o = await svc({ APP_ENV: 'development' }).createOrder(1180, 'r1');
    expect(o).toMatchObject({ amount: 118000, currency: 'INR', mock: true });
    expect(o.id).toMatch(/^order_mock_/);
  });
  it('refuses mock payments in production', async () => {
    await expect(svc({ APP_ENV: 'production' }).createOrder(10, 'r')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it('verifies the checkout signature (order|payment, HMAC with key secret)', () => {
    const s = svc({ APP_ENV: 'test', RAZORPAY_KEY_SECRET: 'sek' });
    const sig = hmacSha256('sek', 'order_1|pay_1');
    expect(s.verifyPayment('order_1', 'pay_1', sig)).toBe(true);
    expect(s.verifyPayment('order_1', 'pay_2', sig)).toBe(false);
    expect(s.verifyPayment('order_1', 'pay_1', 'bad')).toBe(false);
  });
  it('verifies webhook signatures over the raw body and rejects when no secret is set', () => {
    const s = svc({ RAZORPAY_WEBHOOK_SECRET: 'wh' });
    const body = Buffer.from('{"event":"payment.captured"}');
    expect(s.verifyWebhook(body, hmacSha256('wh', body))).toBe(true);
    expect(s.verifyWebhook(body, 'nope')).toBe(false);
    expect(svc({}).verifyWebhook(body, hmacSha256('wh', body))).toBe(false);
  });
});
