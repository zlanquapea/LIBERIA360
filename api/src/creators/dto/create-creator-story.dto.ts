import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import {
  CreatorStoryMediaType,
  CreatorStoryVisibility,
} from "../entities/creator-story.entity";

export class CreateCreatorStoryDto {
  @IsEnum(CreatorStoryMediaType)
  mediaType: CreatorStoryMediaType;

  @IsString()
  @MaxLength(500)
  mediaUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  caption?: string;

  @IsOptional()
  @IsEnum(CreatorStoryVisibility)
  visibility?: CreatorStoryVisibility;

  @IsOptional()
  @IsUUID()
  placeId?: string;

  @IsOptional()
  @IsUUID()
  eventId?: string;

  @IsOptional()
  @IsUUID()
  tripId?: string;

  @IsOptional()
  @IsUUID()
  creatorProfileId?: string;
}

export class ReportCreatorStoryDto {
  @IsString()
  @MaxLength(500)
  reason: string;
}
