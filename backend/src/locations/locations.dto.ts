import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export const PINCODE_RE = /^[1-9]\d{5}$/;
export class CreateCityDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsOptional() @IsIn(['live', 'soon', 'hidden']) status?: 'live' | 'soon' | 'hidden';
}
export class UpdateCityDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @IsOptional() @IsIn(['live', 'soon', 'hidden']) status?: 'live' | 'soon' | 'hidden';
}
export class CreateAreaDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @Matches(PINCODE_RE, { message: 'pincode must be a valid 6-digit PIN' }) pincode: string;
}
/** Rename an area. The PIN code is not editable: leads keep their own PIN code, so changing it would leave them mismatched. */
export class UpdateAreaDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
}
export class TipPincodeDto {
  @Matches(PINCODE_RE) pincode: string;
  @Type(() => Number) @IsInt() tip_user_id: number;
}
export class TipPincodeQuery {
  @IsOptional() @Matches(PINCODE_RE) pincode?: string;
  @IsOptional() @Type(() => Number) @IsInt() tip_user_id?: number;
}
export class TipPincodeUpdateDto { @IsBoolean() is_active: boolean; }
export { Length };

export class ReverseQuery {
  @Type(() => Number) @IsNumber() @Min(6) @Max(38) lat: number;   // India's bounding box
  @Type(() => Number) @IsNumber() @Min(68) @Max(98) lng: number;
}

export class ImportPinsDto {
  @Type(() => Number) @IsInt() city_id: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @Matches(PINCODE_RE, { each: true, message: 'each pincode must be a valid 6-digit PIN' }) pincodes: string[];
}
