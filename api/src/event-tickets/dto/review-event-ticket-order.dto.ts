import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { EventTicketOrderStatus } from "../entities/event-ticket-order.entity";

export class ReviewEventTicketOrderDto {
  @IsEnum(EventTicketOrderStatus)
  status: EventTicketOrderStatus.APPROVED | EventTicketOrderStatus.REJECTED;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string;
}
