import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Booking } from "./entities/booking.entity";
import { BookingStatus } from "./entities/booking.enums";
import { Business } from "../businesses/entities/business.entity";
import { Creator } from "../creators/entities/creator.entity";
import { CreateBookingDto } from "./dto/create-booking.dto";
import { RespondBookingDto } from "./dto/respond-booking.dto";
import { NotificationsService } from "../notifications/notifications.service";

// Both parties manage every booking — requests they sent, and requests
// made against a listing they own — from the same page, so every booking
// notification links here rather than trying to guess a more specific
// destination.
const BOOKINGS_LINK = "/account/bookings";

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    @InjectRepository(Creator)
    private readonly creatorRepo: Repository<Creator>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(userId: string, dto: CreateBookingDto): Promise<Booking> {
    if (!dto.businessId === !dto.creatorId) {
      throw new BadRequestException(
        "Provide exactly one of businessId or creatorId",
      );
    }

    if (dto.businessId) {
      const exists = await this.businessRepo.exists({
        where: { id: dto.businessId },
      });
      if (!exists) {
        throw new NotFoundException(`Business "${dto.businessId}" not found`);
      }
    } else {
      const exists = await this.creatorRepo.exists({
        where: { id: dto.creatorId },
      });
      if (!exists) {
        throw new NotFoundException(`Creator "${dto.creatorId}" not found`);
      }
    }

    if (new Date(dto.requestedDate) < startOfToday()) {
      throw new BadRequestException("requestedDate cannot be in the past");
    }
    if (
      dto.requestedEndDate &&
      new Date(dto.requestedEndDate) < new Date(dto.requestedDate)
    ) {
      throw new BadRequestException(
        "requestedEndDate cannot be before requestedDate",
      );
    }

    const booking = await this.bookingRepo.save(
      this.bookingRepo.create({
        businessId: dto.businessId ?? null,
        creatorId: dto.creatorId ?? null,
        guestUserId: userId,
        requestedDate: dto.requestedDate,
        requestedEndDate: dto.requestedEndDate ?? null,
        partySize: dto.partySize ?? null,
        notes: dto.notes ?? null,
      }),
    );
    const saved = await this.bookingRepo.findOneOrFail({
      where: { id: booking.id },
    });

    const ownerUserId = getOwnerUserId(saved);
    if (ownerUserId) {
      await this.notificationsService.create(ownerUserId, {
        type: "booking.requested",
        title: "New booking request",
        body: `${saved.guest.name} requested a booking for ${saved.requestedDate}.`,
        link: BOOKINGS_LINK,
      });
    }
    return saved;
  }

  /** Business/creator owner confirms or declines a pending request. */
  async respond(
    userId: string,
    bookingId: string,
    dto: RespondBookingDto,
  ): Promise<Booking> {
    const booking = await this.findWithTarget(bookingId);
    if (getOwnerUserId(booking) !== userId) {
      throw new ForbiddenException(
        "Only the business/creator owner can respond to this booking",
      );
    }
    if (booking.status !== BookingStatus.PENDING) {
      throw new ConflictException(
        `This booking has already been ${booking.status}`,
      );
    }

    booking.status =
      dto.action === "confirm"
        ? BookingStatus.CONFIRMED
        : BookingStatus.DECLINED;
    booking.businessResponse = dto.message ?? null;
    booking.respondedAt = new Date();
    await this.bookingRepo.save(booking);

    const listingName =
      booking.business?.name ?? booking.creator?.name ?? "the listing";
    await this.notificationsService.create(booking.guestUserId, {
      type: dto.action === "confirm" ? "booking.confirmed" : "booking.declined",
      title:
        dto.action === "confirm" ? "Booking confirmed" : "Booking declined",
      body:
        dto.action === "confirm"
          ? `${listingName} confirmed your booking for ${booking.requestedDate}.`
          : `${listingName} declined your booking for ${booking.requestedDate}.`,
      link: BOOKINGS_LINK,
    });

    return this.bookingRepo.findOneOrFail({ where: { id: bookingId } });
  }

  /** Guest cancels their own pending or confirmed request. */
  async cancel(userId: string, bookingId: string): Promise<Booking> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException(`Booking "${bookingId}" not found`);
    }
    if (booking.guestUserId !== userId) {
      throw new ForbiddenException("You can only cancel your own bookings");
    }
    if (
      booking.status !== BookingStatus.PENDING &&
      booking.status !== BookingStatus.CONFIRMED
    ) {
      throw new ConflictException(
        `This booking is already ${booking.status} and can't be cancelled`,
      );
    }

    booking.status = BookingStatus.CANCELLED;
    await this.bookingRepo.save(booking);
    return this.bookingRepo.findOneOrFail({ where: { id: bookingId } });
  }

  findMine(userId: string): Promise<Booking[]> {
    return this.bookingRepo.find({
      where: { guestUserId: userId },
      order: { createdAt: "DESC" },
    });
  }

  async findForBusiness(
    userId: string,
    businessId: string,
  ): Promise<Booking[]> {
    const business = await this.businessRepo.findOne({
      where: { id: businessId },
    });
    if (!business) {
      throw new NotFoundException(`Business "${businessId}" not found`);
    }
    if (business.ownerUserId !== userId) {
      throw new ForbiddenException(
        "Only the business owner can view its bookings",
      );
    }

    return this.bookingRepo.find({
      where: { businessId },
      order: { createdAt: "DESC" },
    });
  }

  /** Same as findForBusiness, for a creator's own incoming requests. */
  async findForCreator(userId: string, creatorId: string): Promise<Booking[]> {
    const creator = await this.creatorRepo.findOne({
      where: { id: creatorId },
    });
    if (!creator) {
      throw new NotFoundException(`Creator "${creatorId}" not found`);
    }
    if (creator.userId !== userId) {
      throw new ForbiddenException(
        "Only the creator can view their own bookings",
      );
    }

    return this.bookingRepo.find({
      where: { creatorId },
      order: { createdAt: "DESC" },
    });
  }

  private async findWithTarget(bookingId: string): Promise<Booking> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException(`Booking "${bookingId}" not found`);
    }
    return booking;
  }
}

/** The user allowed to respond to/manage a booking — the business owner
 * or the creator, whichever this booking targets. Exported for
 * BookingMessagesService, which needs the identical "who's a participant"
 * check for messaging. */
export function getOwnerUserId(booking: Booking): string | null {
  return booking.business?.ownerUserId ?? booking.creator?.userId ?? null;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
