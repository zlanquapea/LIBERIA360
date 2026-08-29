import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";
import { CarCategory, CarTransmission } from "../entities/car-listing.enums";

export class QueryCarListingsDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(CarCategory) category?: CarCategory;
  @IsOptional() @IsEnum(CarTransmission) transmission?: CarTransmission;
  @IsOptional() @IsUUID() countyId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minSeats?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPricePerDay?: number;

  // A plain `@Type(() => Boolean)` would coerce the *string* "false" to
  // `true` (any non-empty string is truthy) since query params always
  // arrive as strings — same fix as QueryLoginActivityDto's onlyFailed.
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  withDriverAvailable?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
