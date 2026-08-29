import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import {
  CarCategory,
  CarFuelType,
  CarTransmission,
} from "../entities/car-listing.enums";

const CURRENT_YEAR = new Date().getFullYear();

// No `businessId` — same reasoning as UpdateBusinessDto excluding
// `placeId`/UpdateAdvertisementDto excluding `type`: which business a
// listing belongs to isn't something an owner should be able to quietly
// reassign themselves.
export class UpdateCarListingDto {
  @IsOptional() @IsString() @MaxLength(150) title?: string;
  @IsOptional() @IsString() @MaxLength(60) make?: string;
  @IsOptional() @IsString() @MaxLength(60) model?: string;
  @IsOptional() @IsInt() @Min(1990) @Max(CURRENT_YEAR + 1) year?: number;
  @IsOptional() @IsEnum(CarCategory) category?: CarCategory;
  @IsOptional() @IsEnum(CarTransmission) transmission?: CarTransmission;
  @IsOptional() @IsEnum(CarFuelType) fuelType?: CarFuelType;
  @IsOptional() @IsInt() @Min(1) @Max(30) seats?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100000) pricePerDay?: number;
  @IsOptional() @IsBoolean() withDriverAvailable?: boolean;
  @IsOptional() @IsNumber() @Min(0) @Max(50000) driverFeePerDay?: number;
  @IsOptional() @IsInt() @Min(1) @Max(90) minRentalDays?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(500000) securityDeposit?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  images?: string[];

  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(200) pickupLocation?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
