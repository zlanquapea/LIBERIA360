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

export class UpdatePlaceDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase, kebab-case (e.g. "ceecee-beach")',
  })
  slug?: string;

  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(PlaceType) type?: PlaceType;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() countyId?: string;
  @IsOptional() @IsString() @MaxLength(150) city?: string;
  @IsOptional() @IsLatitude() latitude?: number;
  @IsOptional() @IsLongitude() longitude?: number;

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
