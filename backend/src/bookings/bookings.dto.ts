import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQuery } from '../common/pagination';

export class CreateBookingDto {
  @Type(() => Number) @IsInt() lead_id: number;
  @IsDateString() scheduled_at: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
export class UpdateBookingDto {
  @IsOptional() @IsDateString() scheduled_at?: string;
  @IsOptional() @IsIn(['cancelled']) status?: 'cancelled';
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
export class CompleteBookingDto {
  @IsString() @MaxLength(60) connection_id: string;
  @IsOptional() @IsString() @MaxLength(60) router_serial?: string;
  @IsOptional() @IsString() @MaxLength(20) router_mac?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
export class BookingQuery extends PageQuery {
  @IsOptional() @IsIn(['scheduled', 'completed', 'rescheduled', 'cancelled']) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() lead_id?: number;
  @IsOptional() @IsString() q?: string;
  /** modem state filter for the Care plan page */
  @IsOptional() @IsIn(['offline', 'weak', 'unlinked']) device?: string;
  /** scheduled_at window: from (inclusive) to (exclusive) */
  @IsOptional() @IsDateString() scheduled_from?: string;
  @IsOptional() @IsDateString() scheduled_to?: string;
}
