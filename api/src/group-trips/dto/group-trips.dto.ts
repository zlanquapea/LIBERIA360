import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import {
  TripPaymentMethod,
  TripPaymentPlan,
} from "../entities/group-trip.enums";

export class TripOrganiserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logo?: string | null;
}

/** PUT /itineraries/:id/hosting — open a trip for bookings, or change how
 * it's run. A null clears an optional field. */
export class HostingDto {
  @IsOptional()
  @IsBoolean()
  open?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  tagline?: string | null;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  price: number;

  @IsIn(["USD", "LRD"])
  currency: "USD" | "LRD";

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  depositAmount?: number | null;

  @IsOptional()
  @IsDateString()
  balanceDueDate?: string | null;

  @IsOptional()
  @IsDateString()
  bookingDeadline?: string | null;

  @IsInt()
  @Min(1)
  @Max(1000)
  spots: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxPerBooking?: number;

  @IsOptional()
  @IsBoolean()
  requireApproval?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  includes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  excludes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  activities?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  meetingPoint?: string | null;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "departureTime must look like 07:30",
  })
  departureTime?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => TripOrganiserDto)
  organisers?: TripOrganiserDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  gallery?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  goodToKnow?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  contactPhone?: string | null;

  @IsOptional()
  @IsBoolean()
  cashEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  mtnMomoNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  orangeMoneyNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  accountName?: string | null;

  /** The trip's poster photo — stored on the trip itself. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImage?: string | null;
}

/** POST /itineraries/:id/bookings */
export class BookTripDto {
  @IsInt()
  @Min(1)
  @Max(20)
  seats: number;

  /** One name per spot, the booker first. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  travellers: string[];

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  contactName: string;

  @IsString()
  @MinLength(5)
  @MaxLength(30)
  phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsEnum(TripPaymentPlan)
  paymentPlan?: TripPaymentPlan;

  @IsOptional()
  @IsEnum(TripPaymentMethod)
  paymentMethod?: TripPaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  paymentReference?: string;

  /** Put me on the waitlist if there aren't enough spots. */
  @IsOptional()
  @IsBoolean()
  joinWaitlist?: boolean;
}

/** POST /trip-bookings/:id/payments — a traveller sending mobile money,
 * or the organiser recording money they took in hand. */
export class TripPaymentDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsEnum(TripPaymentMethod)
  method: TripPaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  reference?: string;
}

export class ReviewTripPaymentDto {
  @IsBoolean()
  received: boolean;
}

export class TripBookingNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** POST /trip-bookings/:id/board — tick a traveller (or everyone on the
 * booking, when `traveller` is left out) on the departure roll call. */
export class BoardTripDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(19)
  traveller?: number;

  @IsBoolean()
  boarded: boolean;
}
