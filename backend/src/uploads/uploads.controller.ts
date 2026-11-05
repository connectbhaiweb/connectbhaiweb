import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsIn } from 'class-validator';
import { AuthUser, CurrentUser, Public } from '../common/decorators';
import { UploadPurpose, UploadsService } from './uploads.service';

class SignDto { @IsIn(['kyc', 'ticket', 'chat', 'logo', 'sheet']) purpose: UploadPurpose; }

@ApiTags('uploads') @ApiBearerAuth() @Controller('uploads')
export class UploadsController {
  constructor(private s: UploadsService) {}

  /** Step 1 of an upload: get signed parameters, then the browser POSTs the file to Cloudinary directly. */
  @Public() @Throttle({ default: { limit: 15, ttl: 60_000 } }) @Post('sign')
  sign(@Body() d: SignDto, @CurrentUser() u?: AuthUser) { return this.s.sign(d.purpose, u); }
}
