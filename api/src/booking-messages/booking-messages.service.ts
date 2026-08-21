import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BookingMessage } from "./entities/booking-message.entity";
import { Booking } from "../bookings/entities/booking.entity";
import { getOwnerUserId } from "../bookings/bookings.service";
import { CreateBookingMessageDto } from "./dto/create-booking-message.dto";

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
