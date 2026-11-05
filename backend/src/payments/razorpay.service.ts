import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { hmacSha256, safeEqualHex } from '../common/utils/crypto';

export interface GatewayOrder { id: string; amount: number; currency: string; key_id: string; mock: boolean }

/**
 * Razorpay gateway. With no RAZORPAY_KEY_ID it runs in MOCK mode (non-production only):
 * orders are local and signatures are computed with the same HMAC scheme, so the full flow is testable.
 */
@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  constructor(private cfg: ConfigService) {}

  private get keyId() { return this.cfg.get<string>('RAZORPAY_KEY_ID') || ''; }
  private get keySecret() { return this.cfg.get<string>('RAZORPAY_KEY_SECRET') || ''; }
  get isMock() { return !this.keyId; }

  private assertUsable() {
    if (this.isMock && this.cfg.get('APP_ENV') === 'production') throw new ServiceUnavailableException('Online payments are not configured');
  }
  private get secret() { return this.keySecret || 'mock-secret'; }

  async createOrder(amountRupees: number, receipt: string): Promise<GatewayOrder> {
    this.assertUsable();
    const amount = Math.round(amountRupees * 100);
    if (this.isMock) return { id: `order_mock_${randomBytes(8).toString('hex')}`, amount, currency: 'INR', key_id: 'mock', mock: true };
    const r = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64') },
      body: JSON.stringify({ amount, currency: 'INR', receipt: receipt.slice(0, 40) }),
    });
    if (!r.ok) { this.logger.error(`Razorpay order failed: ${r.status}`); throw new ServiceUnavailableException('Payment gateway error'); }
    const o: any = await r.json();
    return { id: o.id, amount: o.amount, currency: o.currency, key_id: this.keyId, mock: false };
  }

  /** Checkout signature = HMAC_SHA256(order_id|payment_id, key_secret). */
  verifyPayment(orderId: string, paymentId: string, signature: string) {
    this.assertUsable();
    return safeEqualHex(hmacSha256(this.secret, `${orderId}|${paymentId}`), signature);
  }
  /** Webhook signature = HMAC_SHA256(raw_body, webhook_secret). */
  verifyWebhook(rawBody: Buffer | string, signature: string) {
    const s = this.cfg.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!s || !signature) return false;
    return safeEqualHex(hmacSha256(s, rawBody), signature);
  }
  signForTests(orderId: string, paymentId: string) { return hmacSha256(this.secret, `${orderId}|${paymentId}`); }
}
