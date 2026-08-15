import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Matches,
  MaxLength,
  Min,
} from "class-validator";
import {
  PlaceType,
  RecommendedVisitLength,
} from "../../places/entities/place.enums";

// Admin content management (Tech Spec §8) — the first way to create a Place
// through the API at all; Phase 1/2 only ever read the catalog (seeded via
// scripts). rating/reviewCount/verificationStatus stay server-managed
// (recomputed from reviews / set via the dedicated verification endpoint),
// not settable here.
export class CreatePlaceDto {
  @IsString()
  @MaxLength(200)
  name: string;

  // Explicit rather than server-generated: the catalog has no slugify
  // helper yet, and an admin choosing the URL deliberately avoids silent
  // collisions between similarly-named places in different counties.
  @IsString()
  @MaxLength(220)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase, kebab-case (e.g. "ceecee-beach")',
  })
  slug: string;

  @IsString()
  description: string;

  @IsEnum(PlaceType)
  type: PlaceType;

  @IsUUID()
  categoryId: string;

  @IsUUID()
  countyId: string;

  @IsString()
  @MaxLength(150)
  city: string;

  @IsLatitude()
  latitude: number;

  @IsLongitude()
  longitude: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];

  @IsOptional() @IsNumber() @Min(0) distanceFromMonroviaKm?: number;

  @IsOptional()
  @IsEnum(RecommendedVisitLength)
  recommendedVisitLength?: RecommendedVisitLength;

  @IsOptional() @IsNumber() @Min(0) estimatedCostEntry?: number;
  @IsOptional() @IsNumber() @Min(0) estimatedCostGuide?: number;
  @IsOptional() @IsNumber() @Min(0) estimatedCostTransport?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  videos?: string[];

  @IsOptional() @IsString() openingHours?: string;
  @IsOptional() @IsString() @MaxLength(40) contactPhone?: string;
  @IsOptional() @IsString() @MaxLength(40) whatsapp?: string;
  @IsOptional() @IsUrl() website?: string;
  @IsOptional() @IsString() @MaxLength(100) instagram?: string;
  @IsOptional() @IsString() @MaxLength(100) facebook?: string;

  @IsOptional() @IsBoolean() featured?: boolean;
}
