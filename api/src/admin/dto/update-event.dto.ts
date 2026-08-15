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
import { EventCategory } from "../../events/entities/event.enums";

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
}
