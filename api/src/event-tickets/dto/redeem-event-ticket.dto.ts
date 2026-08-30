import { IsString, MaxLength, MinLength } from "class-validator";

export class RedeemEventTicketDto {
  @IsString()
  @MinLength(60)
  @MaxLength(300)
  payload: string;
}
