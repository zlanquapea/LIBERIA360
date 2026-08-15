import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class RespondBookingDto {
  @IsIn(["confirm", "decline"])
  action: "confirm" | "decline";

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}
