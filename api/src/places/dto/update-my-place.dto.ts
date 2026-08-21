import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from "class-validator";
import { PlaceType, RecommendedVisitLength } from "../entities/place.enums";

// A submitter editing their own place after the fact — same shape as
// CreatePlaceSubmissionDto but every field optional (a partial edit, not a
// full resubmission), and still no slug/type-of-review/owner control, same
// reasoning as UpdateBusinessDto.
export class UpdateMyPlaceDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(PlaceType) type?: PlaceType;

  @IsOptional() @IsString() @MaxLength(150) city?: string;
  @IsOptional() @IsLatitude() latitude?: number;
  @IsOptional() @IsLongitude() longitude?: number;

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
