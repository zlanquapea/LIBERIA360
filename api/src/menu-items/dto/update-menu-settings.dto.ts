import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import { MENU_CURRENCIES, MenuCurrency } from "../entities/menu-item.enums";

// Digits with optional leading +, spaces or dashes, e.g. "0777 123 456" or
// "+231 88 123 4567". An empty string clears the number.
const PHONE = /^$|^\+?[0-9][0-9 -]{5,18}[0-9]$/;

export class UpdateMenuSettingsDto {
  @IsOptional() @IsIn(MENU_CURRENCIES) currency?: MenuCurrency;

  @IsOptional() @IsBoolean() pickupEnabled?: boolean;
  @IsOptional() @IsBoolean() deliveryEnabled?: boolean;

  @IsOptional() @IsNumber() @Min(0) @Max(100000) deliveryFee?: number;

  // null clears it (no free-delivery threshold).
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  @Min(0)
  @Max(100000)
  freeDeliveryMinimum?: number | null;

  @IsOptional() @IsString() @MaxLength(300) deliveryAreas?: string;
  @IsOptional() @IsString() @MaxLength(40) deliveryEstimate?: string;

  @IsOptional() @IsBoolean() cashEnabled?: boolean;

  @IsOptional()
  @IsString()
  @Matches(PHONE, { message: "Enter a valid MTN MoMo number" })
  mtnMomoNumber?: string;

  @IsOptional()
  @IsString()
  @Matches(PHONE, { message: "Enter a valid Orange Money number" })
  orangeMoneyNumber?: string;

  @IsOptional() @IsString() @MaxLength(100) mobileMoneyName?: string;
}
