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
}
