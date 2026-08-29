import { Type } from "class-transformer";
import { IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

// Exactly one of placeId/creatorId/carListingId — enforced in
// ReviewsService.find.
export class QueryReviewsDto {
  @IsOptional()
  @IsUUID()
  placeId?: string;

  @IsOptional()
  @IsUUID()
  creatorId?: string;

  @IsOptional()
  @IsUUID()
  carListingId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
