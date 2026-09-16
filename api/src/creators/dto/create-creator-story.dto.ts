import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";
import {
  CreatorStoryMediaType,
  CreatorStoryVisibility,
  STORY_REACTION_EMOJIS,
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

export class CreateCreatorStoryReactionDto {
  @IsIn(STORY_REACTION_EMOJIS)
  emoji: string;
}

export class CreateCreatorStoryCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  body: string;
}
