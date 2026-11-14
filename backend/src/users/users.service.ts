import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { JobsService } from '../common/jobs/jobs.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { encrypt, last4 } from '../common/utils/crypto';
import { normalizePhone } from '../common/utils/phone';
import { publicUser } from '../common/utils/serialize';
import { ChargesService } from '../payments/charges.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { UploadsService } from '../uploads/uploads.service';
import { CreateAdminDto, PartnerStatusDto, RegisterPartnerDto, UpdatePartnerDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService, private cfg: ConfigService, private jwt: JwtService,
    private settings: SettingsService, private charges: ChargesService, private notify: NotificationsService, private uploads: UploadsService,
    private jobs: JobsService,
  ) {
    // background job: WhatsApp to a partner whose application was approved / rejected / suspended
    this.jobs.register('partner_status', async (p: { user_id: number; status: string; reason?: string }) => {
      const u = await this.prisma.user.findUnique({ where: { id: p.user_id } });
      if (!u) return;
      const city = u.city_id ? await this.prisma.city.findUnique({ where: { id: u.city_id } }) : null;
      await this.notify.send({ user_id: p.user_id, phone: u.phone, template: `partner_${p.status}`, payload: { name: u.name, role: u.role, reason: p.reason, partner_code: u.partner_code, area: city?.name ?? u.pincode } });
    });
  }

  /** Public partner sign-up. DSA: free. TIP: an onboarding charge (+GST) is created and must be paid before approval. */
  async registerPartner(d: RegisterPartnerDto) {
    const phone = normalizePhone(d.phone);
    if (!phone) throw new BadRequestException('Enter a valid 10-digit mobile number');
    if (d.role === 'tip' && !d.business_name) throw new BadRequestException('business_name is required for TIP');
    // KYC documents: when Cloudinary is configured all three are required, and each must be a genuine upload from our KYC folder
    const docs: Record<string, any> = {};
    for (const [k, label] of [['aadhaar', 'Aadhaar'], ['pan', 'PAN card'], ['bank_proof', 'bank proof']] as const) {
      const a = d.documents?.[k];
      if (!a) { if (this.uploads.configured) throw new BadRequestException(`Upload your ${label}`); continue; }
      if (!this.uploads.verifyAsset('kyc', a)) throw new BadRequestException(`The ${label} upload could not be verified. Please upload it again.`);
      docs[k] = { public_id: a.public_id, version: a.version, format: a.format ?? null, resource_type: a.resource_type ?? 'image', bytes: a.bytes ?? null };
    }
    const key = this.cfg.getOrThrow<string>('DATA_ENCRYPTION_KEY');
    const code = d.role === 'dsa' ? 'MP09DSA' : 'MP09TIP';

    const fee = d.role === 'tip' ? await this.settings.getNumber('tip_onboarding_fee') : 0;   // read before the transaction so it stays short
    const { user, charge } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          role: d.role, name: d.name.trim(), phone, email: d.email, address: d.address, pincode: d.pincode, city_id: d.city_id,
          business_name: d.business_name, gst_number: d.gst_number, gst_state_code: d.gst_number?.slice(0, 2),
          aadhaar_enc: encrypt(d.aadhaar.replace(/\s/g, ''), key), aadhaar_last4: last4(d.aadhaar),
          pan_enc: encrypt(d.pan, key), pan_last4: last4(d.pan),
          bank_name: d.bank_name, bank_account_enc: encrypt(d.bank_account, key), bank_account_last4: last4(d.bank_account),
          bank_ifsc: d.bank_ifsc, upi_id: d.upi_id, partner_status: 'pending', docs: Object.keys(docs).length ? docs : undefined,
        },
      });
      const user = await tx.user.update({ where: { id: created.id }, data: { partner_code: `${code}${String(created.id).padStart(3, '0')}` } });
      if (d.role === 'tip' && d.service_pincodes?.length) {
        await tx.tipPincodeMapping.createMany({ data: [...new Set(d.service_pincodes)].map((pincode) => ({ pincode, tip_user_id: user.id, is_active: false })), skipDuplicates: true });
      }
      let charge: Awaited<ReturnType<ChargesService['create']>> | null = null;
      if (d.role === 'tip') {
        if (fee > 0) charge = await this.charges.create(tx, { kind: 'tip_onboarding', payer: user, base: fee, description: 'TIP onboarding charge' });
      }
      return { user, charge };
    }).catch((e) => {
      if (e?.code === 'P2002') throw new ConflictException('This mobile number is already registered');   // unique (role, phone): one query less than checking first
      throw e;
    });

    // A DSA pays nothing, so the registration message goes now. A TIP gets it only once the onboarding charge is paid (see ChargesService.settle).
    if (!charge) await this.notify.send({ user_id: user.id, phone, template: 'partner_registered', payload: { name: user.name, role: user.role, partner_code: user.partner_code } });
    const payment_token = charge
      ? await this.jwt.signAsync({ typ: 'pay', charge_id: Number(charge.id) }, { secret: this.cfg.getOrThrow('JWT_SECRET'), expiresIn: '2d' })
      : null;
    return { user: publicUser(user), charge, payment_token };
  }

  async setPartnerStatus(id: number, d: PartnerStatusDto, adminId: number) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u || (u.role !== 'dsa' && u.role !== 'tip')) throw new NotFoundException('Partner not found');
    if (d.status === 'approved' && u.role === 'tip') {
      const onboarding = await this.prisma.charge.findFirst({ where: { payer_user_id: id, kind: 'tip_onboarding', status: { in: ['paid', 'waived'] } } });
      const pendingAny = await this.prisma.charge.findFirst({ where: { payer_user_id: id, kind: 'tip_onboarding' } });
      if (pendingAny && !onboarding) throw new BadRequestException('Onboarding charge is not paid yet');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const x = await tx.user.update({
        where: { id },
        data: { partner_status: d.status, approved_by: d.status === 'approved' ? adminId : u.approved_by, approved_at: d.status === 'approved' ? new Date() : u.approved_at },
      });
      if (u.role === 'tip') await tx.tipPincodeMapping.updateMany({ where: { tip_user_id: id }, data: { is_active: d.status === 'approved' } });
      return x;
    });
    await this.jobs.enqueue('partner_status', { user_id: id, status: d.status, reason: d.reason });
    return publicUser(updated);
  }

  async createAdmin(d: CreateAdminDto) {
    const phone = normalizePhone(d.phone);
    if (!phone) throw new BadRequestException('Enter a valid 10-digit mobile number');
    const u = await this.prisma.user.create({ data: { role: 'admin', name: d.name, phone, password_hash: await bcrypt.hash(d.password, 10) } });
    return publicUser(u);
  }

  /**
   * Admin removes a DSA / TIP application that never went anywhere (still pending, no leads, bookings, tickets, chat,
   * devices or payouts, and no paid money unless force=true). Its unpaid fee, notifications and PIN mappings go with it. Anything with history is refused: disable it instead.
   */
  /** Admin edit of a DSA / TIP's own details, in any status. KYC numbers and the status keep their own flows. */
  async updatePartner(id: number, d: UpdatePartnerDto) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u || !['dsa', 'tip'].includes(u.role)) throw new NotFoundException('DSA / TIP not found');
    const data: Prisma.UserUncheckedUpdateInput = {};
    if (d.name !== undefined) data.name = d.name.trim();
    if (d.business_name !== undefined) data.business_name = d.business_name.trim() || null;
    if (d.email !== undefined) data.email = d.email.trim() || null;
    if (d.address !== undefined) data.address = d.address.trim() || null;
    if (d.pincode !== undefined) data.pincode = d.pincode || null;
    if (d.phone !== undefined) {
      const phone = normalizePhone(d.phone);
      if (!phone) throw new BadRequestException('Enter a valid 10-digit mobile number');
      data.phone = phone;
    }
    if (!Object.keys(data).length) return publicUser(u);
    const updated = await this.prisma.user.update({ where: { id }, data }).catch((e) => {
      if (e?.code === 'P2002') throw new ConflictException('This mobile number is already registered');
      throw e;
    });
    return publicUser(updated);
  }

  /**
   * Admin: permanently delete a DSA / TIP in any status. Their leads stay (they just lose this partner); the installations, payouts,
   * payments, tickets, messages and modems that belong to the partner are deleted with them. One transaction, so it is all or nothing.
   * Connect Bhai's own partner account is the one exception: it carries the platform's own installs.
   */
  async deletePartner(id: number) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u || !['dsa', 'tip'].includes(u.role)) throw new NotFoundException('DSA / TIP not found');
    if (u.is_internal) throw new ConflictException("This is Connect Bhai's own partner account and cannot be deleted. Suspend it instead.");
    await this.prisma.$transaction(async (tx) => {
      // leads and their history stay; they just lose this partner
      await tx.lead.updateMany({ where: { brought_by_user_id: id }, data: { brought_by_user_id: null } });
      await tx.lead.updateMany({ where: { tip_user_id: id }, data: { tip_user_id: null } });
      await tx.lead.updateMany({ where: { customer_user_id: id }, data: { customer_user_id: null } });
      await tx.leadEvent.updateMany({ where: { actor_user_id: id }, data: { actor_user_id: null } });
      // installations, payouts and modems of the partner
      const bookingIds = (await tx.booking.findMany({ where: { tip_user_id: id }, select: { id: true } })).map((b) => b.id);
      if (bookingIds.length) await tx.commission.updateMany({ where: { booking_id: { in: bookingIds } }, data: { booking_id: null } });   // a DSA's payout stays, only unlinked from the booking
      await tx.commission.deleteMany({ where: { dsa_user_id: id } });
      await tx.booking.deleteMany({ where: { tip_user_id: id } });
      await tx.carePlanDevice.deleteMany({ where: { tip_user_id: id } });   // its modem actions and speed tests go with it
      await tx.deviceAction.deleteMany({ where: { requested_by: id } });
      // support: tickets they raised go with their chat; tickets assigned to them are only unassigned
      const ticketIds = (await tx.ticket.findMany({ where: { raised_by: id }, select: { id: true } })).map((t) => t.id);
      if (ticketIds.length) {
        await tx.chatMessage.deleteMany({ where: { thread_type: 'ticket', thread_id: { in: ticketIds } } });
        await tx.chatRead.deleteMany({ where: { thread_type: 'ticket', thread_id: { in: ticketIds } } });
      }
      await tx.ticket.deleteMany({ where: { raised_by: id } });
      await tx.ticket.updateMany({ where: { assigned_to: id }, data: { assigned_to: null } });
      await tx.chatMessage.deleteMany({ where: { sender_user_id: id } });
      await tx.chatRead.deleteMany({ where: { user_id: id } });
      // money they were charged (its lines go with it), messages and sign-in data
      await tx.charge.deleteMany({ where: { payer_user_id: id } });
      await tx.tipPincodeMapping.deleteMany({ where: { tip_user_id: id } });
      await tx.notification.deleteMany({ where: { OR: [{ user_id: id }, { phone: u.phone }] } });
      await tx.otpCode.deleteMany({ where: { phone: u.phone } });
      await tx.user.delete({ where: { id } });
    });
    return { deleted: true, id, phone: u.phone };
  }
}
