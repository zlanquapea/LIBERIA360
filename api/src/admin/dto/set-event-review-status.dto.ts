import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { EventReviewStatus } from "../../events/entities/event.enums";

// The approve/reject decision on a self-submitted event — mirrors
// SetAdvertisementReviewStatusDto exactly for the Event equivalent. An
// admin only ever sets APPROVED or REJECTED here; PENDING is the
// creation-time default, never a decision an admin makes.
export class SetEventReviewStatusDto {
  @IsEnum(EventReviewStatus)
  status: EventReviewStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
