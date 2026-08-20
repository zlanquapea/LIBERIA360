import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

// type/url aren't editable after creation — delete and re-add if either is
// wrong. What's actually worth revising in place is the caption/category/
// gallery position.
export class UpdatePortfolioItemDto {
  @IsOptional() @IsString() @MaxLength(200) caption?: string;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}
