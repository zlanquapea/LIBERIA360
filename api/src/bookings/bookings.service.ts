import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, LessThanOrEqual, MoreThanOrEqual, Repository } from "typeorm";
import { Booking } from "./entities/booking.entity";
import { BookingStatus } from "./entities/booking.enums";
import { Business } from "../businesses/entities/business.entity";
import { Creator } from "../creators/entities/creator.entity";
import { CarListing } from "../car-listings/entities/car-listing.entity";
import { CarListingReviewStatus } from "../car-listings/entities/car-listing.enums";
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
    @InjectRepository(CarListing)
    private readonly carListingRepo: Repository<CarListing>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(userId: string, dto: CreateBookingDto): Promise<Booking> {
    const targetCount = [
      dto.businessId,
      dto.creatorId,
      dto.carListingId,
    ].filter(Boolean).length;
    if (targetCount !== 1) {
      throw new BadRequestException(
        "Provide exactly one of businessId, creatorId, or carListingId",
      );
    }

    let carListing: CarListing | null = null;
    if (dto.businessId) {
      const exists = await this.businessRepo.exists({
        where: { id: dto.businessId },
      });
      if (!exists) {
        throw new NotFoundException(`Business "${dto.businessId}" not found`);
      }
    } else if (dto.creatorId) {
      const exists = await this.creatorRepo.exists({
        where: { id: dto.creatorId },
      });
      if (!exists) {
        throw new NotFoundException(`Creator "${dto.creatorId}" not found`);
      }
    } else {
      // A car can only be requested while it's actually live and
      // bookable — same visibility gate as CarListingsService.
      // findApprovedOne, checked directly here rather than through that
      // service (BookingsService already talks to Business/Creator
      // repos directly for the same reason).
      carListing = await this.carListingRepo.findOne({
        where: {
          id: dto.carListingId,
          reviewStatus: CarListingReviewStatus.APPROVED,
          isActive: true,
        },
      });
      if (!carListing) {
        throw new NotFoundException(
          `Car listing "${dto.carListingId}" not found`,
        );
      }
      if (!dto.requestedEndDate) {
        throw new BadRequestException(
          "requestedEndDate (the return date) is required for a car rental",
        );
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

    let estimatedTotal: number | null = null;
    if (carListing) {
      const days = rentalDays(dto.requestedDate, dto.requestedEndDate!);
      if (days < carListing.minRentalDays) {
        throw new BadRequestException(
          `This car requires at least ${carListing.minRentalDays} rental day(s)`,
        );
      }
      const withDriver =
        Boolean(dto.withDriver) && carListing.withDriverAvailable;
      estimatedTotal =
        days * carListing.pricePerDay +
        (withDriver ? days * (carListing.driverFeePerDay ?? 0) : 0);

      // A car already CONFIRMED for an overlapping date range can't be
      // handed to a second renter — PENDING requests don't block a new
      // one (the owner is still free to decline whichever they don't
      // confirm), only an actual, already-agreed booking does.
      const overlapping = await this.bookingRepo.exists({
        where: {
          carListingId: carListing.id,
          status: BookingStatus.CONFIRMED,
          requestedDate: LessThanOrEqual(dto.requestedEndDate!),
          requestedEndDate: MoreThanOrEqual(dto.requestedDate),
        },
      });
      if (overlapping) {
        throw new ConflictException(
          "This car is already booked for part of the requested dates",
        );
      }
    }

    const booking = await this.bookingRepo.save(
      this.bookingRepo.create({
        businessId: dto.businessId ?? null,
        creatorId: dto.creatorId ?? null,
        carListingId: carListing?.id ?? null,
        guestUserId: userId,
        requestedDate: dto.requestedDate,
        requestedEndDate: dto.requestedEndDate ?? null,
        partySize: dto.partySize ?? null,
        withDriver: carListing
          ? Boolean(dto.withDriver) && carListing.withDriverAvailable
          : false,
        pickupLocation: carListing ? (dto.pickupLocation ?? null) : null,
        estimatedTotal,
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

  /** Business/creator/car-listing owner confirms or declines a pending
   * request. */
  async respond(
    userId: string,
    bookingId: string,
    dto: RespondBookingDto,
  ): Promise<Booking> {
    const booking = await this.findWithTarget(bookingId);
    if (getOwnerUserId(booking) !== userId) {
      throw new ForbiddenException(
        "Only the listing owner can respond to this booking",
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
      booking.business?.name ??
      booking.creator?.name ??
      booking.carListing?.title ??
      "the listing";
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

  /** A business's incoming requests — both bookings made directly against
   * it (a hotel room, a tour) and bookings made against any of its car
   * listings, since a car-rental business's fleet is what actually gets
   * booked, not the business record itself. Two conditions in one query
   * (TypeORM's array-where is an OR, not two separate calls) so the
   * result stays a single, correctly createdAt-ordered list either
   * way. */
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

    const carListingIds = (
      await this.carListingRepo.find({
        where: { businessId },
        select: ["id"],
      })
    ).map((listing) => listing.id);

    return this.bookingRepo.find({
      where:
        carListingIds.length > 0
          ? [{ businessId }, { carListingId: In(carListingIds) }]
          : { businessId },
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

  /** A car-lister's own incoming requests across every car they've listed
   * — the direct-ownership equivalent of findForBusiness/findForCreator,
   * needed because a car listing is no longer necessarily attached to a
   * Business a user manages. No ownership param to check against: the
   * caller's own userId *is* the scope, same as findMine. */
  async findForCarListingOwner(userId: string): Promise<Booking[]> {
    const carListingIds = (
      await this.carListingRepo.find({
        where: { ownerUserId: userId },
        select: ["id"],
      })
    ).map((listing) => listing.id);

    if (carListingIds.length === 0) {
      return [];
    }
    return this.bookingRepo.find({
      where: { carListingId: In(carListingIds) },
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

/** The user allowed to respond to/manage a booking — the business owner,
 * the creator, or the car listing's own direct owner, whichever this
 * booking targets. Exported for BookingMessagesService, which needs the
 * identical "who's a participant" check for messaging. */
export function getOwnerUserId(booking: Booking): string | null {
  return (
    booking.business?.ownerUserId ??
    booking.creator?.userId ??
    booking.carListing?.ownerUserId ??
    null
  );
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Whole calendar days between a pickup and return date, floored to at
 * least 1 — a same-day rental is still one rental day, not zero. */
function rentalDays(requestedDate: string, requestedEndDate: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.round(
    (new Date(requestedEndDate).getTime() - new Date(requestedDate).getTime()) /
      msPerDay,
  );
  return Math.max(1, days);
}
