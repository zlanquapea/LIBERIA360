import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { PlaceReviewStatus } from "../../places/entities/place.enums";

// One flexible endpoint for every review-lifecycle transition (approve,
// reject, request changes, suspend) — see SetBusinessReviewStatusDto,
// which this mirrors exactly for the Place equivalent.
export class SetPlaceReviewStatusDto {
  @IsEnum(PlaceReviewStatus)
  status: PlaceReviewStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
