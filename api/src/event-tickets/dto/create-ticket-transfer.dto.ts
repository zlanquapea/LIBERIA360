import { IsEmail } from "class-validator";

export class CreateTicketTransferDto {
  @IsEmail()
  email: string;
}
