import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PageQuery } from '../common/pagination';

const TYPES = ['fiber', 'airfiber', 'tv', 'ott', 'sim'] as const;

export class PlanQuery extends PageQuery {
  @IsOptional() @Matches(/^[1-9]\d{5}$/) pincode?: string;
  @IsOptional() @IsIn(TYPES) type?: (typeof TYPES)[number];
  @IsOptional() @Type(() => Number) @IsInt() category_id?: number;
  @IsOptional() @IsString() brand?: string;
  /** budget, BEFORE GST (the plan sheet's "Price_ex_GST") */
  @IsOptional() @Type(() => Number) @IsNumber() min_price?: number;
  @IsOptional() @Type(() => Number) @IsNumber() max_price?: number;
  @IsOptional() @Type(() => Number) @IsInt() min_speed?: number;
  @IsOptional() @IsString() ott?: string;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsIn(['price_asc', 'price_desc', 'speed_desc']) sort?: 'price_asc' | 'price_desc' | 'speed_desc';
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() include_inactive?: boolean;
}
export class CategoryDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsOptional() @IsIn(TYPES) type?: (typeof TYPES)[number];
  @IsOptional() @IsString() @MaxLength(255) logo_url?: string;
  @IsOptional() @IsInt() sort_order?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
}
export class CreatePlanDto {
  @IsString() @MinLength(2) @MaxLength(40) plan_code: string;
  @Type(() => Number) @IsInt() category_id: number;
  @IsString() @MinLength(2) @MaxLength(160) name: string;
  @IsOptional() @IsInt() @Min(0) speed_mbps?: number;
  @IsOptional() @IsString() @MaxLength(40) data_limit?: string;
  @IsOptional() @IsInt() @Min(0) validity_days?: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(10000000) price: number;
  @IsOptional() @IsNumber() @Min(0) install_charge?: number;
  @IsOptional() @IsNumber() @Min(0) router_charge?: number;
  @IsOptional() @IsBoolean() needs_install?: boolean;
  @IsOptional() @IsBoolean() has_tv?: boolean;
  @IsOptional() @IsInt() @Min(0) tv_channels?: number;
  @IsOptional() @IsObject() benefits?: Record<string, any>;
  @IsOptional() @IsBoolean() is_active?: boolean;
}
export class UpdatePlanDto {
  @IsOptional() @Type(() => Number) @IsInt() category_id?: number;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) name?: string;
  @IsOptional() @IsInt() @Min(0) speed_mbps?: number;
  @IsOptional() @IsString() @MaxLength(40) data_limit?: string;
  @IsOptional() @IsInt() @Min(0) validity_days?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price?: number;
  @IsOptional() @IsNumber() @Min(0) install_charge?: number;
  @IsOptional() @IsNumber() @Min(0) router_charge?: number;
  @IsOptional() @IsBoolean() needs_install?: boolean;
  @IsOptional() @IsBoolean() has_tv?: boolean;
  @IsOptional() @IsInt() @Min(0) tv_channels?: number;
  @IsOptional() @IsObject() benefits?: Record<string, any>;
  @IsOptional() @IsBoolean() is_active?: boolean;
}
export class OttDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsOptional() @IsString() @MaxLength(255) logo_url?: string;
  @IsOptional() @IsBoolean() is_active?: boolean;
}
export class SetPlanOttDto { @IsArray() @ArrayUnique() @ArrayMaxSize(100) @Type(() => Number) @IsInt({ each: true }) ott_app_ids: number[]; }
export class SetPincodePlansDto { @IsArray() @ArrayUnique() @ArrayMaxSize(500) @Type(() => Number) @IsInt({ each: true }) plan_ids: number[]; }
