import { Delete, Body, Controller, Get, NotFoundException, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { AuthUser, CurrentUser, Public, Roles } from '../common/decorators';
import { pageArgs, paged } from '../common/pagination';
import { UploadsService } from '../uploads/uploads.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { fulltextIds } from '../common/utils/fulltext';
import { publicUser } from '../common/utils/serialize';
import { ActiveDto, CreateAdminDto, PartnerStatusDto, RegisterPartnerDto, UpdateMeDto, UpdatePartnerDto, UserQuery } from './users.dto';
import { UsersService } from './users.service';

@ApiTags('users') @Controller()
export class UsersController {
  constructor(private users: UsersService, private prisma: PrismaService, private uploads: UploadsService) {}

  @Public() @Post('partners/register')
  register(@Body() d: RegisterPartnerDto) { return this.users.registerPartner(d); }

  @ApiBearerAuth() @Get('users/me')
  async me(@CurrentUser() u: AuthUser) { return publicUser(await this.prisma.user.findUniqueOrThrow({ where: { id: u.id }, omit: { password_hash: true, aadhaar_enc: true, pan_enc: true, bank_account_enc: true } })); }   // runs on every page load: do not read the encrypted KYC columns

  @ApiBearerAuth() @Patch('users/me')
  async updateMe(@CurrentUser() u: AuthUser, @Body() d: UpdateMeDto) { return publicUser(await this.prisma.user.update({ where: { id: u.id }, data: d })); }

  @ApiBearerAuth() @Roles('admin') @Get('users')
  async list(@Query() q: UserQuery) {
    const ids = q.q ? await fulltextIds(this.prisma, 'users', q.q) : null;   // index lookup; null (1 character / no index) = slow "contains" filter below
    const where: Prisma.UserWhereInput = {
      role: q.role, partner_status: q.partner_status,
      ...(q.q ? (ids ? { id: { in: ids } } : { OR: [{ name: { contains: q.q } }, { phone: { contains: q.q } }, { partner_code: { contains: q.q } }] }) : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({ where, orderBy: { id: 'desc' }, omit: { password_hash: true, aadhaar_enc: true, pan_enc: true, bank_account_enc: true }, ...pageArgs(q) }),
      this.prisma.user.count({ where }),
    ]);
    return paged(items.map((x) => publicUser(x)), total, q);
  }

  @ApiBearerAuth() @Roles('admin') @Get('users/:id')
  async one(@Param('id', ParseIntPipe) id: number) {
    const x = await this.prisma.user.findUnique({ where: { id }, include: { tip_pincodes: true } });
    if (!x) throw new NotFoundException('User not found');
    return publicUser(x);
  }

  /** Admin reviews a DSA/TIP's KYC documents. Files stay private in Cloudinary; each link works for 10 minutes. */
  @ApiBearerAuth() @Roles('admin') @Get('users/:id/documents')
  async documents(@Param('id', ParseIntPipe) id: number) {
    const x = await this.prisma.user.findUnique({ where: { id }, select: { docs: true, role: true } });
    if (!x) throw new NotFoundException('User not found');
    const docs = (x.docs ?? {}) as Record<string, any>;
    const label: Record<string, string> = { aadhaar: 'Aadhaar', pan: 'PAN card', bank_proof: 'Bank proof' };
    return { configured: this.uploads.configured, documents: ['aadhaar', 'pan', 'bank_proof'].filter((k) => docs[k]).map((key) => [key, docs[key]] as const).map(([key, d]) => ({ key, label: label[key] ?? key, format: d.format, bytes: d.bytes, url: this.uploads.configured ? this.uploads.downloadUrl(d) : null })) };
  }

  @ApiBearerAuth() @Roles('admin') @Patch('users/:id/partner-status')
  setStatus(@Param('id', ParseIntPipe) id: number, @Body() d: PartnerStatusDto, @CurrentUser() a: AuthUser) { return this.users.setPartnerStatus(id, d, a.id); }

  @ApiBearerAuth() @Roles('admin') @Patch('users/:id/active')
  async setActive(@Param('id', ParseIntPipe) id: number, @Body() d: ActiveDto) { return publicUser(await this.prisma.user.update({ where: { id }, data: { is_active: d.is_active } })); }

  /** Admin: edit a DSA / TIP's details in any status. */
  @ApiBearerAuth() @Roles('admin') @Patch('users/:id')
  updatePartner(@Param('id', ParseIntPipe) id: number, @Body() d: UpdatePartnerDto) { return this.users.updatePartner(id, d); }

  /** Admin: permanently delete a DSA / TIP in any status (their leads stay; see UsersService.deletePartner). */
  @ApiBearerAuth() @Roles('admin') @Delete('users/:id')
  deletePartner(@Param('id', ParseIntPipe) id: number) { return this.users.deletePartner(id); }

  @ApiBearerAuth() @Roles('admin') @Post('users/admins')
  createAdmin(@Body() d: CreateAdminDto) { return this.users.createAdmin(d); }
}
