import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PageQuery } from '../common/pagination';

export class ChargeQuery extends PageQuery {
  @IsOptional() @IsIn(['tip_onboarding', 'tip_install_fee', 'tip_care_plan_fee', 'customer_payment', 'other']) kind?: string;
  @IsOptional() @IsIn(['pending', 'paid', 'failed', 'waived', 'cancelled', 'refunded']) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() payer_user_id?: number;
  @IsOptional() @IsString() q?: string;
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
/** The amount is always the lead's plan price (read from the plan on the server), so the customer sends only the lead. */
export class CustomerChargeDto {
  @Type(() => Number) @IsInt() lead_id: number;
}
/** Admin or the lead's TIP records a plan payment taken outside the app (cash, UPI to the TIP). */
export class LeadOfflinePaidDto { @IsOptional() @IsString() @MaxLength(80) reference?: string; }
