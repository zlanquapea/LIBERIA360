import { IsBoolean } from "class-validator";
export class NotificationPreferencesDto {
  @IsBoolean() bookings: boolean;
  @IsBoolean() messages: boolean;
  @IsBoolean() trips: boolean;
  @IsBoolean() creators: boolean;
}
