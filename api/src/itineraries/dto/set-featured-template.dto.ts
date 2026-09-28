import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class SetFeaturedTemplateDto {
  @IsBoolean()
  isFeaturedTemplate: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  featuredCategory?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  featuredOrder?: number;
}
