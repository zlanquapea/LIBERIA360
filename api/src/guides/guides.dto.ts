import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import {
  ExperienceCategory,
  ExperienceGroupType,
  ExperienceStatus,
  GuideBookingStatus,
  GuideType,
  GuideVerificationStatus,
} from "./entities/guide.enums";

export class ApplyGuideDto {
  @IsEnum(GuideType)
  guideType: GuideType;

  @IsString()
  @MinLength(30)
  @MaxLength(4000)
  bio: string;

  @IsString()
  @MaxLength(120)
  city: string;

  @IsOptional()
  @IsString()
  countyId?: string;

  @IsArray()
  @IsString({ each: true })
  languages: string[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ltaLicenseNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  whatsappNumber?: string;

  @IsString()
  @MaxLength(180)
  slug: string;

  @IsOptional()
  @IsUrl()
  profileImageUrl?: string;
}

export class CreateExperienceDto {
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title: string;

  @IsString()
  @MinLength(30)
  @MaxLength(10000)
  description: string;

  @IsEnum(ExperienceCategory)
  category: ExperienceCategory;

  @IsString()
  @MaxLength(120)
  county: string;

  @IsOptional()
  @IsString()
  placeId?: string;

  @IsInt()
  @Min(15)
  @Max(1440)
  durationMinutes: number;

  @IsEnum(ExperienceGroupType)
  groupType: ExperienceGroupType;

  @IsInt()
  @Min(1)
  @Max(500)
  maxGroupSize: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  priceUsd: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  priceLrd?: number;

  @IsString()
  @MaxLength(300)
  meetingPointText: string;

  @IsOptional()
  @IsNumber()
  meetingLat?: number;

  @IsOptional()
  @IsNumber()
  meetingLng?: number;

  @IsArray()
  @IsString({ each: true })
  includes: string[];

  @IsString()
  @MaxLength(4000)
  cancellationPolicy: string;

  @IsOptional()
  @IsUrl()
  coverImageUrl?: string;

  @IsOptional()
  @IsEnum(ExperienceStatus)
  status?: ExperienceStatus;
}

export class QueryGuidesDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(ExperienceCategory)
  category?: ExperienceCategory;

  @IsOptional()
  @IsString()
  county?: string;

  @IsOptional()
  @IsString()
  language?: string;
}

export class CreateGuideBookingDto {
  @IsDateString()
  requestedDate: string;

  @IsInt()
  @Min(1)
  @Max(500)
  groupSize: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class RespondGuideBookingDto {
  @IsEnum(GuideBookingStatus)
  status:
    | GuideBookingStatus.CONFIRMED
    | GuideBookingStatus.DECLINED
    | GuideBookingStatus.COMPLETED;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  response?: string;
}

export class CreateGuideReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  comment?: string;
}

export class SetGuideVerificationDto {
  @IsEnum(GuideVerificationStatus)
  status: GuideVerificationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class UpdateGuideProfileImageDto {
  @IsOptional()
  @IsUrl()
  profileImageUrl?: string | null;
}
