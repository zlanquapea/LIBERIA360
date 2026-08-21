import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from "class-validator";

// A claimed business's owner editing their own listing after the fact —
// unlike CreateBusinessDto (the one-time claim), there's no `type` or
// `placeId` here: what business this is and what Place it's linked to
// aren't things an owner should be able to change themselves.
export class UpdateBusinessDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(40) whatsapp?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsUrl() website?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  socialLinks?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  // Photos of the place itself — rooms, pool, storefront, menu, whatever
  // best shows what a traveler is actually booking. Each entry is a URL
  // returned by POST /uploads/image (or any externally-hosted image URL).
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  images?: string[];

  @IsOptional() @IsUrl() logoImage?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  videos?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  openingHours?: string;

  @IsOptional() @IsNumber() @Min(0) @Max(1000000) priceRangeMin?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1000000) priceRangeMax?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  servicesOffered?: string[];
}
