import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { CreatorPostMediaType } from "../entities/creator-post.enums";

export class CreateCreatorPostDto {
  @IsEnum(CreatorPostMediaType)
  mediaType: CreatorPostMediaType;

  // Uses the same safe uploaded-image or external-video URL contract as the
  // existing creator portfolio. Video uploads remain external-link only until
  // a dedicated transcoding/storage pipeline exists.
  @IsString()
  @MaxLength(500)
  mediaUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  caption?: string;
}
