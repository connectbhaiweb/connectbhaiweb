import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { CurrentUser, AuthUser, Public, Roles } from '../common/decorators';
import { SettingsService } from './settings.service';

class SetSettingDto { @IsString() @MaxLength(255) value: string; }

@ApiTags('settings') @ApiBearerAuth() @Controller('settings')
export class SettingsController {
  constructor(private s: SettingsService) {}
  /** Non-sensitive amounts the website shows before login (partner fees, GST). */
  @Public() @Get('public')
  async publicSettings() {
    const keys = ['tip_onboarding_fee', 'tip_install_fee', 'care_plan_fee_per_lead', 'gst_percent'];
    const out: Record<string, number> = {};
    for (const k of keys) out[k] = await this.s.getNumber(k);
    return out;
  }
  /** What a logged-in DSA / TIP (or admin) sees about their own rates: the same for every DSA and every TIP, set in Admin > Settings. */
  @Roles('admin', 'dsa', 'tip') @Get('partner')
  async partnerSettings() {
    const keys = ['tip_install_fee', 'dsa_payout_per_lead', 'gst_percent', 'lead_target_default'];
    const out: Record<string, number> = {};
    for (const k of keys) out[k] = await this.s.getNumber(k);
    return out;
  }
  @Roles('admin') @Get() list() { return this.s.list(); }
  @Roles('admin') @Put(':key') async set(@Param('key') key: string, @Body() dto: SetSettingDto, @CurrentUser() u: AuthUser) {
    await this.s.set(key, dto.value, u.id);
    return this.s.list();
  }
}
