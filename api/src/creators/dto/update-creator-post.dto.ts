import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
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
}
