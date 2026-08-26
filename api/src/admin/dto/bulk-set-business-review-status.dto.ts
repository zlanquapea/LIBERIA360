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
import { BusinessReviewStatus } from "../../businesses/entities/business.enums";

// Bulk sibling of SetBusinessReviewStatusDto — see its doc comment for
// the status/reason shape; BulkSetPlaceReviewStatusDto for why 50.
export class BulkSetBusinessReviewStatusDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID(undefined, { each: true })
  ids: string[];

  @IsEnum(BusinessReviewStatus)
  status: BusinessReviewStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
