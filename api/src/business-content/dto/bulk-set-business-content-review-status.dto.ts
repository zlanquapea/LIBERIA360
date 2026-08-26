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
import { BusinessContentStatus } from "../entities/business-content.enums";

// Bulk sibling of SetBusinessContentReviewStatusDto — see
// BulkSetPlaceReviewStatusDto (admin/dto) for the ids-array/50-cap
// convention this mirrors.
export class BulkSetBusinessContentReviewStatusDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID(undefined, { each: true })
  ids: string[];

  @IsEnum(BusinessContentStatus)
  status: BusinessContentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
