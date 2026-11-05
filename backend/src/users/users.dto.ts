import { Type } from 'class-transformer';
import { ValidateNested, ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PageQuery } from '../common/pagination';

/** What Cloudinary returned after the browser uploaded the file (signed by Cloudinary, re-verified on our server). */
export class UploadedDocDto {
  @IsString() @MaxLength(200) public_id: string;
  @Type(() => Number) @IsInt() version: number;
  @IsString() @MaxLength(80) signature: string;
  @IsOptional() @IsString() @MaxLength(10) format?: string;
  @IsOptional() @IsString() @MaxLength(10) resource_type?: string;
  @IsOptional() @Type(() => Number) @IsInt() bytes?: number;
}
export class PartnerDocsDto {
  @IsOptional() @ValidateNested() @Type(() => UploadedDocDto) aadhaar?: UploadedDocDto;
  @IsOptional() @ValidateNested() @Type(() => UploadedDocDto) pan?: UploadedDocDto;
  @IsOptional() @ValidateNested() @Type(() => UploadedDocDto) bank_proof?: UploadedDocDto;
}

export class RegisterPartnerDto {
  @IsOptional() @ValidateNested() @Type(() => PartnerDocsDto) documents?: PartnerDocsDto;
  @IsIn(['dsa', 'tip']) role: 'dsa' | 'tip';
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsString() phone: string;
  @IsOptional() @IsEmail() email?: string;
  @IsString() @MinLength(5) @MaxLength(255) address: string;
  @Matches(/^[1-9]\d{5}$/) pincode: string;
  @IsOptional() @Type(() => Number) @IsInt() city_id?: number;
  @IsOptional() @IsString() @MaxLength(160) business_name?: string;
  @IsOptional() @Matches(/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/, { message: 'Invalid GSTIN' }) gst_number?: string;
  @Matches(/^\d{4}\s?\d{4}\s?\d{4}$/, { message: 'Aadhaar must be 12 digits' }) aadhaar: string;
  @Matches(/^[A-Z]{5}\d{4}[A-Z]$/, { message: 'Invalid PAN' }) pan: string;
  @IsString() @MaxLength(120) bank_name: string;
  @Matches(/^\d{6,20}$/, { message: 'Invalid bank account number' }) bank_account: string;
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, { message: 'Invalid IFSC' }) bank_ifsc: string;
  @IsOptional() @IsString() @MaxLength(80) upi_id?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @Matches(/^[1-9]\d{5}$/, { each: true }) service_pincodes?: string[];
}
export class UpdateMeDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(255) address?: string;
  @IsOptional() @Matches(/^[1-9]\d{5}$/) pincode?: string;
}
export class UserQuery extends PageQuery {
  @IsOptional() @IsIn(['customer', 'dsa', 'tip', 'admin']) role?: 'customer' | 'dsa' | 'tip' | 'admin';
  @IsOptional() @IsIn(['pending', 'approved', 'rejected', 'suspended']) partner_status?: 'pending' | 'approved' | 'rejected' | 'suspended';
  @IsOptional() @IsString() q?: string;
}
export class PartnerStatusDto {
  @IsIn(['approved', 'rejected', 'suspended']) status: 'approved' | 'rejected' | 'suspended';
  @IsOptional() @IsString() @MaxLength(255) reason?: string;
}
export class ActiveDto { @IsBoolean() is_active: boolean; }
export class CreateAdminDto {
  @IsString() @MinLength(2) name: string;
  @IsString() phone: string;
  @IsString() @MinLength(8) @MaxLength(100) password: string;
}
