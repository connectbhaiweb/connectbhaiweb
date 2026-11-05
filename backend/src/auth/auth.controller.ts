import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators';
import { PasswordLoginDto, RefreshDto, RequestOtpDto, VerifyOtpDto } from './auth.dto';
import { AuthService } from './auth.service';

@ApiTags('auth') @Public() @Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('otp/request') @HttpCode(200)
  requestOtp(@Body() d: RequestOtpDto) { return this.auth.requestOtp(d.phone, d.role); }

  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post('otp/verify') @HttpCode(200)
  verifyOtp(@Body() d: VerifyOtpDto) { return this.auth.verifyOtp(d.phone, d.code, d.role, d.name); }

  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post('login') @HttpCode(200)
  login(@Body() d: PasswordLoginDto) { return this.auth.passwordLogin(d.phone, d.password, d.role); }

  @Post('refresh') @HttpCode(200)
  refresh(@Body() d: RefreshDto) { return this.auth.refresh(d.refresh_token); }
}
