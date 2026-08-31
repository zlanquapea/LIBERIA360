import {
  IsInt,
  IsOptional,
  IsString,
  IsArray,
  IsObject,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreateEventTicketOrderDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  quantity?: number;

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  selections?: Array<{ ticketTypeId: string; quantity: number }>;

  @IsString()
  @MaxLength(255)
  paymentReference: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  paymentNote?: string;
}
