import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { User } from "../users/entities/user.entity";
import { EventTicketsService } from "./event-tickets.service";

/** The recipient's side of a ticket transfer — a separate top-level
 * controller (not nested under EventTicketsController, which guards every
 * route with JwtAuthGuard at the class level) for the same reason
 * TripInvitationsController is separate: GET /token/:token must be
 * reachable by an unauthenticated visitor opening the emailed link,
 * before they've necessarily signed in. */
@ApiTags("Ticket Transfers")
@Controller("ticket-transfers")
export class TicketTransfersController {
  constructor(private readonly ticketsService: EventTicketsService) {}

  /** Public, unauthenticated preview for the emailed link's landing page. */
  @Get("token/:token")
  getPreview(@Param("token") token: string) {
    return this.ticketsService.getTransferPreview(token);
  }

  /** Emailed-link flow: accept while holding the token. */
  @Post("token/:token/accept")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  acceptByToken(@CurrentUser() user: User, @Param("token") token: string) {
    return this.ticketsService.acceptTransferByToken(user, token);
  }

  /** Emailed-link flow: decline while holding the token. */
  @Post("token/:token/decline")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async declineByToken(
    @CurrentUser() user: User,
    @Param("token") token: string,
  ) {
    await this.ticketsService.declineTransferByToken(user, token);
  }

  /** In-app flow: accept a transfer already linked to this account — the
   * "My Tickets" page's pending-transfers list, no token in hand needed. */
  @Post(":id/accept")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  acceptById(@CurrentUser() user: User, @Param("id") id: string) {
    return this.ticketsService.acceptTransferById(user, id);
  }

  /** In-app flow: decline a transfer already linked to this account. */
  @Post(":id/decline")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async declineById(@CurrentUser() user: User, @Param("id") id: string) {
    await this.ticketsService.declineTransferById(user, id);
  }

  /** Sender-side: cancel a still-pending outgoing transfer. */
  @Post(":id/cancel")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  cancel(@CurrentUser() user: User, @Param("id") id: string) {
    return this.ticketsService.cancelTransfer(id, user);
  }
}
