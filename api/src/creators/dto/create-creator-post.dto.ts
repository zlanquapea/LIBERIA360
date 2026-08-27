import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
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
  @MaxLength(2000)
  caption?: string;
}
