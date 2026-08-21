import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
  Min,
} from "class-validator";
import { PlaceType, RecommendedVisitLength } from "../entities/place.enums";

// Self-service place submission (PlacesService.submitPlace) — a business
// owner listing a destination that isn't in the catalog yet. Same field
// set as the admin's CreatePlaceDto, minus what only makes sense for an
// admin curating the catalog directly:
//   - slug: server-generated (see buildPlaceSlug), not typed by hand — a
//     submitter picking their own URL risks colliding with (or squatting)
//     another listing's slug before an admin ever sees it.
//   - featured: an editorial call, never self-service.
// review_status/submitted_at/owner_user_id are set by the service, not the
// caller — see PlacesService.submitPlace.
export class CreatePlaceSubmissionDto {
  @IsString()
  @MaxLength(200)
  name: string;

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
}
