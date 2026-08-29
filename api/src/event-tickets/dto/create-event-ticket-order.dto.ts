import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreateEventTicketOrderDto {
  @IsInt()
  @Min(1)
  @Max(20)
  quantity: number;

  @IsString()
  @MaxLength(255)
  paymentReference: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  paymentNote?: string;
}
