import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { BusinessContentStatus } from "../entities/business-content.enums";

// Mirrors SetBusinessReviewStatusDto's shape — one endpoint for
// approve/reject, `reason` is the rejection reason when rejecting.
export class SetBusinessContentReviewStatusDto {
  @IsEnum(BusinessContentStatus)
  status: BusinessContentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
