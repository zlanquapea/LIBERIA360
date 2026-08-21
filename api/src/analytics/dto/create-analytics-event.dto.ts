import { IsEnum, IsOptional, IsUUID } from "class-validator";
import { AnalyticsEventType } from "../entities/analytics-event.enums";

// Exactly one of placeId/creatorId — enforced in AnalyticsService.record.
export class CreateAnalyticsEventDto {
  @IsOptional()
  @IsUUID()
  placeId?: string;

  @IsOptional()
  @IsUUID()
  creatorId?: string;

  @IsEnum(AnalyticsEventType)
  eventType: AnalyticsEventType;
}
