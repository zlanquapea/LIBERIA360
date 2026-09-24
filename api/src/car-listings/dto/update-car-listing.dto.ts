import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import {
  CarCancellationPolicy,
  CarCategory,
  CarFuelPolicy,
  CarFuelType,
  CarTransmission,
} from "../entities/car-listing.enums";

const CURRENT_YEAR = new Date().getFullYear();

// No `businessId` — same reasoning as UpdateBusinessDto excluding
// `placeId`/UpdateAdvertisementDto excluding `type`: which (optional)
// business a listing links to isn't something an owner should be able
// to quietly reassign themselves.
export class UpdateCarListingDto {
  @IsOptional() @IsUUID() countyId?: string;
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
  @IsOptional() @IsNumber() @Min(0) @Max(100000) pricePerHour?: number;
  @IsOptional() @IsInt() @Min(1) @Max(24) minRentalHours?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(50000) driverFeePerHour?: number;

  // These, unlike the fields above, accept an explicit `null` so an owner
  // can clear a previously-set value — `undefined` (the key simply absent
  // from the request body) leaves the stored value untouched, since
  // `CarListingsService.update`'s `Object.assign(listing, dto)` only
  // overwrites keys actually present on `dto`.
  @IsOptional() @IsString() @MaxLength(60) color?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(5000) mileageLimitPerDay?: number | null;
  @IsOptional() @IsNumber() @Min(0) @Max(10000) excessMileageFee?:
    number | null;
  @IsOptional() @IsEnum(CarFuelPolicy) fuelPolicy?: CarFuelPolicy | null;
  @IsOptional() @IsInt() @Min(16) @Max(99) minDriverAge?: number | null;
  @IsOptional() @IsBoolean() additionalDriverAllowed?: boolean;
  @IsOptional() @IsNumber() @Min(0) @Max(50000) additionalDriverFee?:
    number | null;
  @IsOptional() @IsBoolean() insuranceIncluded?: boolean;
  @IsOptional() @IsString() @MaxLength(1000) insuranceNotes?: string | null;
  @IsOptional()
  @IsEnum(CarCancellationPolicy)
  cancellationPolicy?: CarCancellationPolicy | null;
  @IsOptional() @IsBoolean() deliveryAvailable?: boolean;
  @IsOptional() @IsNumber() @Min(0) @Max(50000) deliveryFee?: number | null;
  @IsOptional() @IsBoolean() instantBookEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @IsString({ each: true })
  images?: string[];

  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(200) pickupLocation?: string;
  @IsOptional() @IsString() @MaxLength(40) contactPhone?: string;
  @IsOptional() @IsString() @MaxLength(40) contactWhatsapp?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
