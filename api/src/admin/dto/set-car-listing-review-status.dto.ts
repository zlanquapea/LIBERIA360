import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { CarListingReviewStatus } from "../../car-listings/entities/car-listing.enums";

// One flexible endpoint for every review-lifecycle transition (approve,
// reject, suspend) — mirrors SetAdvertisementReviewStatusDto exactly for
// the CarListing equivalent.
export class SetCarListingReviewStatusDto {
  @IsEnum(CarListingReviewStatus)
  status: CarListingReviewStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
