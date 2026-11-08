import { BadRequestException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma/prisma.service';
import { normalizePhone } from '../common/utils/phone';
import { randomDigits, safeEqualHex, sha256 } from '../common/utils/crypto';
import { publicUser } from '../common/utils/serialize';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService, private cfg: ConfigService, private notify: NotificationsService) {}

  private hashOtp(phone: string, code: string) { return sha256(`${phone}:${code}:${this.cfg.get('JWT_SECRET')}`); }

  async requestOtp(rawPhone: string, role?: UserRole) {
    const phone = normalizePhone(rawPhone);
    if (!phone) throw new BadRequestException('Enter a valid 10-digit mobile number');
    if (role && role !== 'customer') {
      const u = await this.prisma.user.findUnique({ where: { role_phone: { role, phone } } });
      await this.assertCanLogin(u);
    }
    const recent = await this.prisma.otpCode.count({ where: { phone, created_at: { gt: new Date(Date.now() - 10 * 60_000) } } });
    if (recent >= 5) throw new HttpException('Too many OTP requests. Try again in a few minutes.', HttpStatus.TOO_MANY_REQUESTS);

    const dev = this.cfg.get<string>('OTP_DEV_CODE');
    const isProd = this.cfg.get('APP_ENV') === 'production';
    const code = !isProd && dev ? dev : randomDigits(6);
    const ttl = Number(this.cfg.get('OTP_TTL_MINUTES'));
    await this.prisma.otpCode.create({ data: { phone, code_hash: this.hashOtp(phone, code), purpose: 'login', expires_at: new Date(Date.now() + ttl * 60_000) } });
    await this.notify.send({ phone, template: 'otp', payload: { code, minutes: ttl } });
    return { sent: true, expires_in_seconds: ttl * 60 };
  }

  async verifyOtp(rawPhone: string, code: string, role?: UserRole, name?: string) {
    const phone = normalizePhone(rawPhone);
    if (!phone) throw new BadRequestException('Enter a valid 10-digit mobile number');
    const otp = await this.prisma.otpCode.findFirst({ where: { phone, used_at: null, expires_at: { gt: new Date() } }, orderBy: { id: 'desc' } });
    if (!otp) throw new UnauthorizedException('OTP expired or not requested');
    if (otp.attempts >= Number(this.cfg.get('OTP_MAX_ATTEMPTS'))) throw new UnauthorizedException('Too many wrong attempts. Request a new OTP.');
    if (!safeEqualHex(otp.code_hash, this.hashOtp(phone, code))) {
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw new UnauthorizedException('Incorrect OTP');
    }
    await this.prisma.otpCode.update({ where: { id: otp.id }, data: { used_at: new Date() } });

    // no role given (phone-only login screen): use the most privileged account on this number, else a customer
    if (!role) role = await this.pickRole(phone, ['admin', 'tip', 'dsa', 'customer']) ?? 'customer';   // skips a partner account that is still waiting for approval when the same number also has a customer account
    let user = await this.prisma.user.findUnique({ where: { role_phone: { role, phone } } });
    if (!user) {
      if (role !== 'customer') throw new UnauthorizedException('No account found for this number');
      user = await this.prisma.user.create({ data: { role: 'customer', phone, name: name?.trim() || 'Customer' } });
    }
    await this.assertCanLogin(user);
    return this.issue(user);
  }

  /**
   * The most privileged account on this number that can log in. A DSA / TIP application still waiting for approval is skipped
   * when the same number is also a customer: a customer never needs approval. If nothing can log in, the most privileged account is
   * returned so the person sees the real reason (for example "waiting for approval").
   */
  private async pickRole(phone: string, order: UserRole[]) {
    const rows = await this.prisma.user.findMany({ where: { phone } });
    const mine = order.map((r) => rows.find((x) => x.role === r)).filter((u): u is User => !!u);
    for (const u of mine) {
      try { await this.assertCanLogin(u); return u.role; } catch { /* try the next account on this number */ }
    }
    return mine[0]?.role;
  }

  async passwordLogin(rawPhone: string, password: string, role?: UserRole) {
    const phone = normalizePhone(rawPhone);
    if (phone && !role) role = await this.pickRole(phone, ['admin', 'tip', 'dsa', 'customer']) ?? 'admin';
    const u = phone && role ? await this.prisma.user.findUnique({ where: { role_phone: { role, phone } } }) : null;
    const ok = u?.password_hash ? await bcrypt.compare(password, u.password_hash) : await bcrypt.compare(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali');
    if (!u || !ok) throw new UnauthorizedException('Incorrect mobile number or password');
    await this.assertCanLogin(u);
    return this.issue(u);
  }

  async refresh(token: string) {
    try {
      const p = await this.jwt.verifyAsync(token, { secret: this.cfg.getOrThrow('JWT_REFRESH_SECRET') });
      if (p.typ !== 'refresh') throw new Error();
      const u = await this.prisma.user.findUnique({ where: { id: Number(p.sub) } });
      await this.assertCanLogin(u);
      return this.issue(u!);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async assertCanLogin(u: User | null) {
    if (!u || !u.is_active) throw new UnauthorizedException('Account not found or disabled');
    if ((u.role === 'tip' || u.role === 'dsa') && u.partner_status !== 'approved') {
      // a TIP who has paid the registration fee may log in while admin approves the application
      if (u.role === 'tip' && u.partner_status === 'pending' && (await this.prisma.charge.count({ where: { payer_user_id: u.id, kind: 'tip_onboarding', status: 'paid' } })) > 0) return;
      throw new UnauthorizedException(u.partner_status === 'pending' ? 'Your account is waiting for approval' : 'Your account is not active');
    }
  }

  private async issue(u: User) {
    await this.prisma.user.update({ where: { id: u.id }, data: { last_login_at: new Date() } });
    const base = { sub: Number(u.id), role: u.role, phone: u.phone };
    const access_token = await this.jwt.signAsync({ ...base, typ: 'access' }, { secret: this.cfg.getOrThrow('JWT_SECRET'), expiresIn: this.cfg.get('JWT_EXPIRES_IN') as any });
    const refresh_token = await this.jwt.signAsync({ ...base, typ: 'refresh' }, { secret: this.cfg.getOrThrow('JWT_REFRESH_SECRET'), expiresIn: this.cfg.get('JWT_REFRESH_EXPIRES_IN') as any });
    return { access_token, refresh_token, user: publicUser(u) };
  }

  /** Logs a TIP in right after the registration fee is paid (the payment itself proves who is at the screen). */
  async sessionAfterPayment(userId: number | bigint) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    await this.assertCanLogin(u);
    return this.issue(u!);
  }
}
