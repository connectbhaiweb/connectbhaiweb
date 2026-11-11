import { Type } from 'class-transformer';
import { IsDateString, IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PageQuery } from '../common/pagination';

export class CreateLeadDto {
  @IsString() @MinLength(2) @MaxLength(120) customer_name: string;
  @IsString() customer_phone: string;
  @IsOptional() @IsEmail() customer_email?: string;
  @IsOptional() @IsString() @MaxLength(255) address?: string;
  @Matches(/^[1-9]\d{5}$/, { message: 'pincode must be a valid 6-digit PIN' }) pincode: string;
  @IsOptional() @Type(() => Number) @IsInt() area_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() plan_id?: number;
  @IsOptional() @IsIn(['website', 'callback']) source?: 'website' | 'callback';
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  /** admin only: attribute the lead to a DSA */
  @IsOptional() @Type(() => Number) @IsInt() brought_by_user_id?: number;
}
export class LeadQuery extends PageQuery {
  @IsOptional() @IsIn(['new', 'contacted', 'followup', 'scheduled', 'installed', 'lost', 'cancelled']) status?: string;
  @IsOptional() @Matches(/^[1-9]\d{5}$/) pincode?: string;
  @IsOptional() @IsIn(['website', 'callback', 'dsa', 'admin']) source?: string;
  @IsOptional() @Type(() => Number) @IsInt() tip_user_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() brought_by_user_id?: number;
  @IsOptional() @IsString() q?: string;
  /** admin: only leads nobody has been assigned to yet (no DSA and no TIP) */
  @IsOptional() @IsIn(['1', 'true']) unassigned?: string;
  /** only leads still being worked (not installed / lost / cancelled) */
  @IsOptional() @IsIn(['1', 'true']) open?: string;
  /** 'followup': next follow-up first, then the most recently updated (page 1 only, for the "call today" list) */
  @IsOptional() @IsIn(['followup']) sort?: string;
  /** follow-ups due today or earlier */
  @IsOptional() @IsIn(['1', 'true']) due?: string;
  /** comma-separated statuses, e.g. "contacted,followup" */
  @IsOptional() @IsString() statuses?: string;
}
export class TrackQuery {
  @IsString() ref_code: string;
  @IsString() phone: string;
}
export class LeadStatusDto {
  @IsIn(['contacted', 'followup', 'lost', 'cancelled']) status: 'contacted' | 'followup' | 'lost' | 'cancelled';
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @IsDateString() followup_at?: string;
  @IsOptional() @IsString() @MaxLength(255) lost_reason?: string;
}
export class AssignDto { @Type(() => Number) @IsInt() tip_user_id: number; }
export class NoteDto { @IsString() @MinLength(1) @MaxLength(500) note: string; }
