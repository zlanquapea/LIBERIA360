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
  CarCategory,
  CarFuelType,
  CarTransmission,
} from "../entities/car-listing.enums";

const CURRENT_YEAR = new Date().getFullYear();

export class CreateCarListingDto {
  @IsUUID()
  countyId: string;

  // Optional — only an actual registered rental company that already has
  // a claimed Business (type CAR_RENTAL) sets this, to also surface the
  // listing on that business's profile. See CarListing's doc comment.
  @IsOptional()
  @IsUUID()
  businessId?: string;

  @IsString()
  @MaxLength(150)
  title: string;

  @IsString()
  @MaxLength(60)
  make: string;

  @IsString()
  @MaxLength(60)
  model: string;

  // A car older than ~30 years is either a collector's item worth its own
  // listing conversation, not a typical rental, or a data-entry mistake —
  // either way worth catching here rather than letting a stray "202" or
  // "1902" onto a public listing.
  @IsInt()
  @Min(1990)
  @Max(CURRENT_YEAR + 1)
  year: number;

  @IsEnum(CarCategory)
  category: CarCategory;

  @IsEnum(CarTransmission)
  transmission: CarTransmission;

  @IsEnum(CarFuelType)
  fuelType: CarFuelType;

  @IsInt()
  @Min(1)
  @Max(30)
  seats: number;

  @IsNumber()
  @Min(0)
  @Max(100000)
  pricePerDay: number;

  @IsOptional()
  @IsBoolean()
  withDriverAvailable?: boolean;

  @IsOptional() @IsNumber() @Min(0) @Max(50000) driverFeePerDay?: number;
  @IsOptional() @IsInt() @Min(1) @Max(90) minRentalDays?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(500000) securityDeposit?: number;

  // Opt-in hourly rental — see CarListing.pricePerHour's doc comment.
  @IsOptional() @IsNumber() @Min(0) @Max(100000) pricePerHour?: number;
  @IsOptional() @IsInt() @Min(1) @Max(24) minRentalHours?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(50000) driverFeePerHour?: number;

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
  @IsOptional() @IsString() @MaxLength(40) contactPhone?: string;
  @IsOptional() @IsString() @MaxLength(40) contactWhatsapp?: string;
}
