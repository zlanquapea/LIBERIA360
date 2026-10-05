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
  ValidateNested,
} from "class-validator";
import {
  FuelLevel,
  RentalPaymentMethod,
  RentalUnit,
} from "../entities/rental.enums";

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CreateRentalDto {
  @IsUUID()
  carListingId: string;

  @IsOptional()
  @IsEnum(RentalUnit)
  rentalUnit?: RentalUnit;

  @IsDateString()
  pickupDate: string;

  // Required for a day rental; an hourly rental is on pickupDate.
  @IsOptional()
  @IsDateString()
  returnDate?: string;

  @Matches(TIME, { message: "pickupTime must be HH:mm" })
  pickupTime: string;

  @Matches(TIME, { message: "returnTime must be HH:mm" })
  returnTime: string;

  @IsOptional()
  @IsBoolean()
  withDriver?: boolean;

  @IsOptional()
  @IsBoolean()
  additionalDriver?: boolean;

  @IsOptional()
  @IsBoolean()
  delivery?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  deliveryAddress?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  renterName: string;

  @IsString()
  @MinLength(6)
  @MaxLength(40)
  renterPhone: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  licenceNumber?: string;

  // The renter confirms they meet the listing's minimum driver age.
  @IsOptional()
  @IsBoolean()
  ageConfirmed?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsEnum(RentalPaymentMethod)
  paymentMethod: RentalPaymentMethod;

  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(80)
  paymentReference?: string;
}

export class RentalSettingsDto {
  @IsOptional()
  @IsBoolean()
  cashAtPickupEnabled?: boolean;

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
}

export class RespondRentalDto {
  @IsIn(["confirm", "decline"])
  action: "confirm" | "decline";

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}

export class VerifyRentalPaymentDto {
  @IsBoolean()
  received: boolean;
}

export class ResendRentalPaymentDto {
  @IsString()
  @MinLength(4)
  @MaxLength(80)
  paymentReference: string;
}

/** The handover: what the car looked like when it left. */
export class HandoverDto {
  @IsBoolean()
  licenceChecked: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9_999_999)
  odometer?: number;

  @IsOptional()
  @IsEnum(FuelLevel)
  fuel?: FuelLevel;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  depositCollected?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  // Cash or mobile money taken at the desk settles the rental.
  @IsOptional()
  @IsBoolean()
  paymentCollected?: boolean;
}

export class ExtraChargeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  label: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100_000)
  amount: number;
}

/** The return: how the car came back, and what's owed either way. */
export class ReturnDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9_999_999)
  odometer?: number;

  @IsOptional()
  @IsEnum(FuelLevel)
  fuel?: FuelLevel;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ExtraChargeDto)
  extraCharges?: ExtraChargeDto[];

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  depositReturned?: number;
}

export class FleetCalendarQueryDto {
  @IsDateString()
  from: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  days?: number;
}

export class RentalMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string;
}
