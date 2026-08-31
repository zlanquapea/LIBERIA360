import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsObject,
  IsUUID,
  MaxLength,
} from "class-validator";
import { EventCategory } from "../entities/event.enums";

export class CreateEventDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsEnum(EventCategory)
  category: EventCategory;

  @IsOptional()
  @IsUUID()
  placeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  locationText?: string;

  // Same map-picker-driven pin as a self-service Place submission — see
  // CreatePlaceSubmissionDto. Optional: locationText alone still satisfies
  // the location requirement (see EventsService.create), a pin just adds a
  // map + directions link on top.
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsUUID()
  countyId: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  ticketInfo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  ticketPrice?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  ticketCurrency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  ticketCapacity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  paymentInstructions?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsObject({ each: true })
  ticketTypes?: Array<Record<string, unknown>>;
}
