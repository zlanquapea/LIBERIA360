import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { User } from "../users/entities/user.entity";
import { CreateEventTicketOrderDto } from "./dto/create-event-ticket-order.dto";
import { ReviewEventTicketOrderDto } from "./dto/review-event-ticket-order.dto";
import { RedeemEventTicketDto } from "./dto/redeem-event-ticket.dto";
import { EventTicketsService } from "./event-tickets.service";

@ApiTags("Event Tickets")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class EventTicketsController {
  constructor(private readonly ticketsService: EventTicketsService) {}

  @Post("events/:eventId/ticket-orders")
  createOrder(
    @Param("eventId") eventId: string,
    @CurrentUser() user: User,
    @Body() dto: CreateEventTicketOrderDto,
  ) {
    return this.ticketsService.createOrder(eventId, user, dto);
  }

  @Get("ticket-orders/mine")
  findMine(@CurrentUser() user: User) {
    return this.ticketsService.findForBuyer(user.id);
  }

  @Get("events/:eventId/ticket-orders")
  findForOrganizer(
    @Param("eventId") eventId: string,
    @CurrentUser() user: User,
  ) {
    return this.ticketsService.findForOrganizer(eventId, user);
  }

  @Post("events/:eventId/ticket-scan")
  redeemTicket(
    @Param("eventId") eventId: string,
    @CurrentUser() user: User,
    @Body() dto: RedeemEventTicketDto,
  ) {
    return this.ticketsService.redeemTicket(eventId, user, dto);
  }

  @Patch("ticket-orders/:id/review")
  review(
    @Param("id") id: string,
    @CurrentUser() user: User,
    @Body() dto: ReviewEventTicketOrderDto,
  ) {
    return this.ticketsService.reviewOrder(id, user, dto);
  }

  @Patch("ticket-instances/:id/void")
  voidTicket(@Param("id") id: string, @CurrentUser() user: User) {
    return this.ticketsService.voidTicket(id, user);
  }
}
