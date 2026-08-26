import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { PlaceReviewStatus } from "../../places/entities/place.enums";

// Bulk sibling of SetPlaceReviewStatusDto — same status/reason shape,
// applied to a batch of places at once from the moderation queue's
// multi-select. Capped at 50 so one request can't become an unbounded
// loop of DB writes and audit-log entries.
export class BulkSetPlaceReviewStatusDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID(undefined, { each: true })
  ids: string[];

  @IsEnum(PlaceReviewStatus)
  status: PlaceReviewStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
