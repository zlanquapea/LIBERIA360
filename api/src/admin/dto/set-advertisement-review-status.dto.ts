import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { AdvertisementReviewStatus } from "../../advertisements/entities/advertisement.enums";

// One flexible endpoint for every review-lifecycle transition (approve,
// reject, suspend) — mirrors SetPlaceReviewStatusDto/
// SetBusinessReviewStatusDto exactly for the Advertisement equivalent.
export class SetAdvertisementReviewStatusDto {
  @IsEnum(AdvertisementReviewStatus)
  status: AdvertisementReviewStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
