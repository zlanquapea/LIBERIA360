import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreateReviewDto {
  @IsUUID()
  placeId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  overallRating: number;

  @IsOptional() @IsInt() @Min(1) @Max(5) experienceRating?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) accessibilityRating?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) cleanlinessRating?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) valueRating?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) safetyRating?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) serviceRating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  // Relative (/uploads/...) or absolute URLs, from POST /uploads/image.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  photos?: string[];
}
