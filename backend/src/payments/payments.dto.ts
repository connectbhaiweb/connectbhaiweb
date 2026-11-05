import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PageQuery } from '../common/pagination';

export class ChargeQuery extends PageQuery {
  @IsOptional() @IsIn(['tip_onboarding', 'tip_install_fee', 'tip_care_plan_fee', 'customer_payment', 'other']) kind?: string;
  @IsOptional() @IsIn(['pending', 'paid', 'failed', 'waived', 'cancelled', 'refunded']) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() payer_user_id?: number;
}
export class PayDto { @IsOptional() @IsString() payment_token?: string; }
export class VerifyPaymentDto {
  @IsString() razorpay_payment_id: string;
  @IsString() razorpay_signature: string;
  @IsOptional() @IsString() payment_token?: string;
}
export class OfflinePaidDto { @IsString() @MaxLength(80) reference: string; }
export class CarePlanPurchaseDto { @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @Type(() => Number) @IsInt({ each: true }) lead_ids: number[]; }

export class CreateChargeDto {
  @Type(() => Number) @IsInt() payer_user_id: number;
  @IsOptional() @IsIn(['tip_onboarding', 'tip_install_fee', 'tip_care_plan_fee', 'customer_payment', 'other']) kind?: any;
  @IsString() @MaxLength(255) description: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(10000000) base_amount: number;
  @IsOptional() @Type(() => Number) @IsInt() lead_id?: number;
}
export class CustomerChargeDto {
  @IsString() @MinLength(3) @MaxLength(200) description: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(200000) amount: number;
  @IsOptional() @Type(() => Number) @IsInt() lead_id?: number;
}
