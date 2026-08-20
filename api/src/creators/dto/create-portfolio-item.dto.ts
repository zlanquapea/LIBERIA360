import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { CreatorPortfolioItemType } from "../entities/creator.enums";

export class CreatePortfolioItemDto {
  @IsEnum(CreatorPortfolioItemType)
  type: CreatorPortfolioItemType;

  // Uploaded image URL (type=image, via POST /uploads/image) or an
  // external video URL to embed (type=video) — not IsUrl-validated since
  // a user-typed video link's exact format varies (youtu.be, instagram
  // reel, etc.), same lightweight-string choice as Creator.contentLinks.
  @IsString()
  @MaxLength(500)
  url: string;

  @IsOptional() @IsString() @MaxLength(200) caption?: string;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
}
