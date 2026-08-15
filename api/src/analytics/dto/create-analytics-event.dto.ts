import { IsEnum, IsUUID } from "class-validator";
import { AnalyticsEventType } from "../entities/analytics-event.enums";

export class CreateAnalyticsEventDto {
  @IsUUID()
  placeId: string;

  @IsEnum(AnalyticsEventType)
  eventType: AnalyticsEventType;
}
