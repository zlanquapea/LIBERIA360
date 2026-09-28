import {
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class PushKeysDto {
  @IsString()
  p256dh: string;

  @IsString()
  auth: string;
}

/** Matches the browser PushSubscription.toJSON() shape. */
export class SubscribePushDto {
  @IsString()
  endpoint: string;

  // PushSubscription.toJSON() may include this browser-managed field. It is
  // intentionally accepted for compatibility but is not stored server-side.
  @IsOptional()
  @IsNumber()
  expirationTime?: number | null;

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;
}
