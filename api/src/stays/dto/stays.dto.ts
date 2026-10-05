import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import {
  STAY_CURRENCIES,
  StayPaymentMethod,
  type StayCurrency,
} from "../entities/stay.enums";

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class RoomTypeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  images?: string[];

  @IsInt()
  @Min(1)
  @Max(20)
  maxGuests: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  bedSummary?: string | null;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10_000_000)
  pricePerNight: number;

  @IsInt()
  @Min(1)
  @Max(500)
  totalRooms: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  amenities?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class StaySettingsDto {
  @IsOptional()
  @IsIn(STAY_CURRENCIES)
  currency?: StayCurrency;

  @IsOptional()
  @Matches(TIME, { message: "Check-in time must be HH:mm" })
  checkInTime?: string;

  @IsOptional()
  @Matches(TIME, { message: "Check-out time must be HH:mm" })
  checkOutTime?: string;

  @IsOptional()
  @IsBoolean()
  instantConfirm?: boolean;

  @IsOptional()
  @IsBoolean()
  payAtPropertyEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  mtnMomoNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  orangeMoneyNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  mobileMoneyAccountName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  cancellationPolicy?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  houseRules?: string | null;
}

export class StayQueryDto {
  @IsDateString()
  checkIn: string;

  @IsDateString()
  checkOut: string;
}

export class CalendarQueryDto {
  @IsDateString()
  from: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  days?: number;
}

export class FrontDeskQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;
}

export class CreateReservationDto {
  @IsUUID()
  roomTypeId: string;

  @IsDateString()
  checkIn: string;

  @IsDateString()
  checkOut: string;

  @IsInt()
  @Min(1)
  @Max(20)
  rooms: number;

  @IsInt()
  @Min(1)
  @Max(100)
  adults: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  children?: number;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  guestName: string;

  @IsString()
  @MinLength(6)
  @MaxLength(40)
  guestPhone: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  arrivalTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  specialRequests?: string;

  @IsEnum(StayPaymentMethod)
  paymentMethod: StayPaymentMethod;

  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(80)
  paymentReference?: string;
}

/** A guest who turned up without booking, recorded by the front desk so
 * the room count stays right. */
export class WalkInDto {
  @IsUUID()
  roomTypeId: string;

  @IsDateString()
  checkOut: string;

  @IsInt()
  @Min(1)
  @Max(20)
  rooms: number;

  @IsInt()
  @Min(1)
  @Max(100)
  adults: number;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  guestName: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  guestPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  roomNumbers?: string;

  @IsOptional()
  @IsBoolean()
  paid?: boolean;
}

export class RespondReservationDto {
  @IsIn(["confirm", "decline"])
  action: "confirm" | "decline";

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}

export class VerifyStayPaymentDto {
  @IsBoolean()
  received: boolean;
}

export class ResendStayPaymentDto {
  @IsString()
  @MinLength(4)
  @MaxLength(80)
  paymentReference: string;
}

export class CheckInDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  roomNumbers?: string;
}

export class RoomBlockDto {
  @IsUUID()
  roomTypeId: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsInt()
  @Min(1)
  @Max(500)
  rooms: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

export class ReservationMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string;
}
