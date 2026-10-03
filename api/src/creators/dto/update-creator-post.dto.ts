import {
  Matches,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { CreatorPostMediaType } from "../entities/creator-post.enums";

export class UpdateCreatorPostDto {
  @IsOptional()
  @IsEnum(CreatorPostMediaType)
  mediaType?: CreatorPostMediaType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  mediaUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  caption?: string;
  @IsOptional()
  @IsString()
  @MaxLength(240)
  @Matches(
    /^(?:|\/(?:places|businesses|guides|experiences)\/[a-zA-Z0-9][a-zA-Z0-9_-]{0,199})$/,
  )
  relatedPath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  relatedLabel?: string;
}
