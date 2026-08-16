import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { BookingMessagesService } from "./booking-messages.service";
import { CreateBookingMessageDto } from "./dto/create-booking-message.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { toPublicUser } from "../users/user.serializer";
import { BookingMessage } from "./entities/booking-message.entity";

// `sender` comes through as an eager relation — strip passwordHash before
// anything leaves the API, same pattern as bookings/reviews/events.
function sanitize(message: BookingMessage) {
  return {
    ...message,
    sender: message.sender ? toPublicUser(message.sender) : null,
  };
}

@Controller("bookings/:bookingId/messages")
@UseGuards(JwtAuthGuard)
export class BookingMessagesController {
  constructor(
    private readonly bookingMessagesService: BookingMessagesService,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: User,
    @Param("bookingId") bookingId: string,
    @Body() dto: CreateBookingMessageDto,
  ) {
    return sanitize(
      await this.bookingMessagesService.create(user.id, bookingId, dto),
    );
  }

  @Get()
  async findForBooking(
    @CurrentUser() user: User,
    @Param("bookingId") bookingId: string,
  ) {
    const messages = await this.bookingMessagesService.findForBooking(
      user.id,
      bookingId,
    );
    return messages.map(sanitize);
  }
}
