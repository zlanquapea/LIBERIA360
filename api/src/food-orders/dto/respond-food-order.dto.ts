import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class RespondFoodOrderDto {
  @IsIn(["confirm", "decline"])
  action: "confirm" | "decline";

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  // Declining a mobile money order because the transaction ID didn't check
  // out. Otherwise a declined mobile money order is marked refund due.
  @IsOptional() @IsBoolean() paymentNotReceived?: boolean;
}
