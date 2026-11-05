import { IsIn, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class RequestOtpDto {
  @IsString() phone: string;
  @IsOptional() @IsIn(['customer', 'dsa', 'tip', 'admin']) role?: 'customer' | 'dsa' | 'tip' | 'admin';
}
export class VerifyOtpDto extends RequestOtpDto {
  @IsString() @Length(4, 8) code: string;
  @IsOptional() @IsString() @MaxLength(120) name?: string;
}
export class PasswordLoginDto {
  @IsString() phone: string;
  @IsString() @MinLength(6) @MaxLength(100) password: string;
  @IsOptional() @IsIn(['dsa', 'tip', 'admin']) role?: 'dsa' | 'tip' | 'admin';
}
export class RefreshDto { @IsString() refresh_token: string; }
