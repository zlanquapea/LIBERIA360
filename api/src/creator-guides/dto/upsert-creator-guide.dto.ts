import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

// Embeddable video hosts, or a file uploaded to this platform.
export const GUIDE_VIDEO_URL =
  /^(https:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/|vimeo\.com\/|player\.vimeo\.com\/video\/)[\w\-?=&/.]+|\/uploads\/[\w\-./]+\.(mp4|webm|mov))$/i;

export class CreatorGuideStopDto {
  @IsUUID()
  placeId: string;

  @IsInt()
  @Min(1)
  @Max(14)
  day: number;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  note?: string | null;
}

export class CreateCreatorGuideDto {
  @IsString()
  @MinLength(4)
  @MaxLength(150)
  title: string;

  @IsString()
  @MinLength(20)
  @MaxLength(4000)
  summary: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImage?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(GUIDE_VIDEO_URL, {
    message: "Video must be a YouTube or Vimeo link, or an uploaded video",
  })
  videoUrl?: string | null;

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CreatorGuideStopDto)
  stops: CreatorGuideStopDto[];

  // Ticked by the creator: they took, or have permission to share, the
  // photos and video in this guide.
  @IsOptional()
  @IsBoolean()
  mediaPermissionConfirmed?: boolean;
}

export class UpdateCreatorGuideDto {
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(4000)
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImage?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(GUIDE_VIDEO_URL, {
    message: "Video must be a YouTube or Vimeo link, or an uploaded video",
  })
  videoUrl?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CreatorGuideStopDto)
  stops?: CreatorGuideStopDto[];

  @IsOptional()
  @IsBoolean()
  mediaPermissionConfirmed?: boolean;
}

export class ReviewCreatorGuideDto {
  @IsBoolean()
  approve: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class QueryCreatorGuidesDto {
  @IsOptional()
  @IsUUID()
  placeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  creator?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}
