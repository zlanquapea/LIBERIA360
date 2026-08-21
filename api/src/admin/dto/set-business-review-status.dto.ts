import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { BusinessReviewStatus } from "../../businesses/entities/business.enums";

// One flexible endpoint for every review-lifecycle transition (approve,
// reject, request changes, suspend), mirroring SetVerificationDto's shape
// rather than a separate route per action — `reason` doubles as rejection
// reason, "changes requested" guidance, or a suspension reason depending
// on `status` (see BusinessReviewStatus's doc comment).
export class SetBusinessReviewStatusDto {
  @IsEnum(BusinessReviewStatus)
  status: BusinessReviewStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
