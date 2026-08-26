import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { BookingMessagesService } from "./booking-messages.service";
import { CreateBookingMessageDto } from "./dto/create-booking-message.dto";
import { UpdateBookingMessageDto } from "./dto/update-booking-message.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { toPublicUser } from "../users/user.serializer";
import { BookingMessage } from "./entities/booking-message.entity";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

// `sender` comes through as an eager relation — strip passwordHash before
// anything leaves the API, same pattern as bookings/reviews/events. A
// deleted message's `body` is redacted here rather than in the service —
// the row itself keeps it (see BookingMessage.deletedAt's doc comment),
// this is just the one place every response funnels through.
function sanitize(message: BookingMessage) {
  return {
    ...message,
    body: message.deletedAt ? null : message.body,
    sender: message.sender ? toPublicUser(message.sender) : null,
  };
}

@ApiTags("Booking Messages")
@Controller("bookings/:bookingId/messages")
@ApiBearerAuth()
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

  // Declared before the ":messageId" routes below — Nest/Express match
  // routes in registration order, and "read" is a literal path segment
  // that would otherwise be swallowed by ":messageId" if that came first.
  @Patch("read")
  async markRead(
    @CurrentUser() user: User,
    @Param("bookingId") bookingId: string,
  ): Promise<{ success: true }> {
    await this.bookingMessagesService.markRead(user.id, bookingId);
    return { success: true };
  }

  @Patch(":messageId")
  async update(
    @CurrentUser() user: User,
    @Param("bookingId") bookingId: string,
    @Param("messageId") messageId: string,
    @Body() dto: UpdateBookingMessageDto,
  ) {
    return sanitize(
      await this.bookingMessagesService.update(
        user.id,
        bookingId,
        messageId,
        dto,
      ),
    );
  }

  @Delete(":messageId")
  async remove(
    @CurrentUser() user: User,
    @Param("bookingId") bookingId: string,
    @Param("messageId") messageId: string,
  ): Promise<{ success: true }> {
    await this.bookingMessagesService.remove(user.id, bookingId, messageId);
    return { success: true };
  }
}
