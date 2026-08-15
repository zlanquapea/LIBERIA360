import { IsString, ValidateNested } from "class-validator";
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

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;
}
