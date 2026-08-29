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

// Exactly one of placeId/creatorId/carListingId — enforced in
// ReviewsService.create, not here (class-validator's XOR-style decorators
// are awkward for independently-optional UUIDs; a plain service-level
// check reads clearer).
export class CreateReviewDto {
  @IsOptional()
  @IsUUID()
  placeId?: string;

  @IsOptional()
  @IsUUID()
  creatorId?: string;

  @IsOptional()
  @IsUUID()
  carListingId?: string;

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
