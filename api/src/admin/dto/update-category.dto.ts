import { IsOptional, IsString, Matches, MaxLength } from "class-validator";

export class UpdateCategoryDto {
  @IsOptional() @IsString() @MaxLength(100) name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase, kebab-case (e.g. "beaches")',
  })
  slug?: string;

  @IsOptional() @IsString() @MaxLength(50) icon?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
}
