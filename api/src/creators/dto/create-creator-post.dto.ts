import {
  Matches,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { CreatorPostMediaType } from "../entities/creator-post.enums";

export class CreateCreatorPostDto {
  @IsEnum(CreatorPostMediaType)
  mediaType: CreatorPostMediaType;

  // The URL may reference an uploaded image/video or an external hosted video.
  // Uploaded video bytes are validated and stored by POST /uploads/video first.
  @IsString()
  @MaxLength(500)
  mediaUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  thumbnailUrl?: string;

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
