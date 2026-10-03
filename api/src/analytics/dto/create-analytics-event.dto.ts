import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { AnalyticsEventType } from "../entities/analytics-event.enums";

// Exactly one of placeId/creatorId/advertisementId/eventId, except for the
// platform-wide types (PLATFORM_EVENT_TYPES), which take none — enforced
// in AnalyticsService.record.
export class CreateAnalyticsEventDto {
  @IsOptional()
  @IsUUID()
  placeId?: string;

  @IsOptional()
  @IsUUID()
  creatorId?: string;

  @IsOptional()
  @IsUUID()
  advertisementId?: string;

  @IsOptional()
  @IsUUID()
  eventId?: string;

  @IsEnum(AnalyticsEventType)
  eventType: AnalyticsEventType;

  // What was searched, for SEARCH events only. Stored trimmed and
  // lowercased; never tied to a user.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string;
}
