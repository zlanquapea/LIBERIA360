import { Type } from "class-transformer";
import { IsDateString, IsInt, IsOptional, Max, Min } from "class-validator";

// GET .../chat/messages — `before` pages backward through history (load
// older messages), while a live poll just re-requests with no `before`
// at all and re-fetches the newest window; the client dedups by id
// against what it already has, the same "just refetch the small recent
// window" approach TripPeoplePanel/NotificationBell already use rather
// than a full delta-sync cursor, which a single trip's chat is too small
// to need.
export class QueryTripMessagesDto {
  @IsOptional()
  @IsDateString()
  before?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}
