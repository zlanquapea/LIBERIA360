import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Not, Repository } from "typeorm";
import { BookingMessage } from "./entities/booking-message.entity";
import { Booking } from "../bookings/entities/booking.entity";
import { getOwnerUserId } from "../bookings/bookings.service";
import { CreateBookingMessageDto } from "./dto/create-booking-message.dto";
import { UpdateBookingMessageDto } from "./dto/update-booking-message.dto";

@Injectable()
export class BookingMessagesService {
  constructor(
    @InjectRepository(BookingMessage)
    private readonly messageRepo: Repository<BookingMessage>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
  ) {}

  async create(
    userId: string,
    bookingId: string,
    dto: CreateBookingMessageDto,
  ): Promise<BookingMessage> {
    await this.assertParticipant(userId, bookingId);

    const message = await this.messageRepo.save(
      this.messageRepo.create({
        bookingId,
        senderUserId: userId,
        body: dto.body,
      }),
    );
    return this.messageRepo.findOneOrFail({ where: { id: message.id } });
  }

  async findForBooking(
    userId: string,
    bookingId: string,
  ): Promise<BookingMessage[]> {
    await this.assertParticipant(userId, bookingId);

    return this.messageRepo.find({
      where: { bookingId },
      order: { createdAt: "ASC" },
    });
  }

  /** Marks every message the *other* participant sent on this booking as
   * read — called when a participant opens the thread, so the sender's
   * side can show a "Viewed" receipt instead of just "Delivered" (see
   * BookingMessage.readAt's doc comment). Never marks the caller's own
   * messages read; a no-op if there's nothing unread. */
  async markRead(userId: string, bookingId: string): Promise<void> {
    await this.assertParticipant(userId, bookingId);

    await this.messageRepo.update(
      { bookingId, senderUserId: Not(userId), readAt: IsNull() },
      { readAt: new Date() },
    );
  }

  /** Edits the sender's own message — WhatsApp/Messenger convention: only
   * the person who wrote it can change it, and doing so is flagged (see
   * BookingMessage.editedAt) rather than silently rewriting history, since
   * this thread can end up mattering in a booking dispute. */
  async update(
    userId: string,
    bookingId: string,
    messageId: string,
    dto: UpdateBookingMessageDto,
  ): Promise<BookingMessage> {
    const message = await this.loadOwnMessage(userId, bookingId, messageId);
    if (message.deletedAt) {
      throw new ConflictException("This message was deleted");
    }

    message.body = dto.body;
    message.editedAt = new Date();
    await this.messageRepo.save(message);
    return this.messageRepo.findOneOrFail({ where: { id: messageId } });
  }

  /** Soft-deletes the sender's own message. The row (and its `body`) stays
   * in the database — see BookingMessage.deletedAt's doc comment — but the
   * controller's sanitize() always redacts it once this is set, so every
   * consumer of the API sees the same "This message was deleted" outcome a
   * hard delete would give, without losing the record if a booking dispute
   * ever needs it. Idempotent: deleting an already-deleted message is a
   * no-op, not an error. */
  async remove(
    userId: string,
    bookingId: string,
    messageId: string,
  ): Promise<void> {
    const message = await this.loadOwnMessage(userId, bookingId, messageId);
    if (message.deletedAt) return;

    message.deletedAt = new Date();
    await this.messageRepo.save(message);
  }

  /** Shared lookup for update()/remove(): confirms the caller participates
   * in the booking, that the message exists on it, and that the caller is
   * the one who sent it — editing/deleting someone else's message is never
   * allowed, unlike reading or posting new ones. */
  private async loadOwnMessage(
    userId: string,
    bookingId: string,
    messageId: string,
  ): Promise<BookingMessage> {
    await this.assertParticipant(userId, bookingId);

    const message = await this.messageRepo.findOne({
      where: { id: messageId, bookingId },
    });
    if (!message) {
      throw new NotFoundException(`Message "${messageId}" not found`);
    }
    if (message.senderUserId !== userId) {
      throw new ForbiddenException(
        "You can only edit or delete your own messages",
      );
    }
    return message;
  }

  /** Only the guest who made the booking or the business/creator owner it
   * was made against can read or post messages on it — same two parties
   * BookingsService already trusts with the booking itself. */
  private async assertParticipant(
    userId: string,
    bookingId: string,
  ): Promise<void> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException(`Booking "${bookingId}" not found`);
    }
    const isGuest = booking.guestUserId === userId;
    const isOwner = getOwnerUserId(booking) === userId;
    if (!isGuest && !isOwner) {
      throw new ForbiddenException(
        "Only the guest or the listing owner can access these messages",
      );
    }
  }
}
