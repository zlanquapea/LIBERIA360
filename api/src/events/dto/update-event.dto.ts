import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { EventCategory } from "../entities/event.enums";

// The organizer-facing counterpart to admin's UpdateEventDto (same field
// set, kept as its own class rather than imported from the admin module
// so events stays self-contained the way places/businesses/creators do —
// admin depends on the feature modules, not the other way around).
export class UpdateEventDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsEnum(EventCategory) category?: EventCategory;
  @IsOptional() @IsUUID() placeId?: string;
  @IsOptional() @IsString() @MaxLength(255) locationText?: string;
  @IsOptional() @IsUUID() countyId?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  images?: string[];

  @IsOptional() @IsString() @MaxLength(500) ticketInfo?: string;
  @IsOptional() @IsString() @MaxLength(20) ticketPrice?: string;
  @IsOptional() @IsString() @MaxLength(3) ticketCurrency?: string;
  @IsOptional() @IsString() @MaxLength(20) ticketCapacity?: string;
  @IsOptional() @IsString() @MaxLength(1000) paymentInstructions?: string;
}
