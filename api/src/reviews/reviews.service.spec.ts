import { ConflictException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ReviewsService } from "./reviews.service";
import { Review } from "./entities/review.entity";
import { Place } from "../places/entities/place.entity";
import { Booking } from "../bookings/entities/booking.entity";
import { BookingStatus } from "../bookings/entities/booking.enums";

const DTO = { placeId: "place-1", overallRating: 5 };

describe("ReviewsService", () => {
  let service: ReviewsService;
  let reviewRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    findOneOrFail: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let placeRepo: { findOne: jest.Mock; update: jest.Mock };
  let bookingQueryBuilder: {
    innerJoin: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    getCount: jest.Mock;
  };
  let bookingRepo: { createQueryBuilder: jest.Mock };

  beforeEach(async () => {
    let saved: Record<string, unknown> = {};
    reviewRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((data) => {
        saved = { id: "review-1", ...data };
        return saved;
      }),
      create: jest.fn((data) => data),
      findOneOrFail: jest.fn(() => saved),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ avg: "5", count: "1" }),
      }),
    };
    placeRepo = {
      findOne: jest.fn().mockResolvedValue({ id: "place-1" }),
      update: jest.fn(),
    };
    bookingQueryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    };
    bookingRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(bookingQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: getRepositoryToken(Review), useValue: reviewRepo },
        { provide: getRepositoryToken(Place), useValue: placeRepo },
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
      ],
    }).compile();

    service = module.get(ReviewsService);
  });

  it("rejects a review for a place that doesn't exist", async () => {
    placeRepo.findOne.mockResolvedValue(null);
    await expect(service.create("user-1", DTO)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("rejects a duplicate review for the same place", async () => {
    reviewRepo.findOne.mockResolvedValue({ id: "existing" });
    await expect(service.create("user-1", DTO)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(reviewRepo.save).not.toHaveBeenCalled();
  });

  it("marks verifiedVisit true when the reviewer has a confirmed booking with a linked business", async () => {
    bookingQueryBuilder.getCount.mockResolvedValue(1);
    const result = await service.create("user-1", DTO);
    expect(result.verifiedVisit).toBe(true);
    expect(bookingQueryBuilder.andWhere).toHaveBeenCalledWith(
      "booking.status = :status",
      { status: BookingStatus.CONFIRMED },
    );
  });

  it("leaves verifiedVisit false when the reviewer has no confirmed booking", async () => {
    bookingQueryBuilder.getCount.mockResolvedValue(0);
    const result = await service.create("user-1", DTO);
    expect(result.verifiedVisit).toBe(false);
  });

  it("still lets a plain review through for a place with no bookable business at all", async () => {
    // Most of the catalog (plain attractions) has no Business behind it —
    // the booking lookup just comes back empty, and the review still
    // succeeds unverified rather than being blocked.
    bookingQueryBuilder.getCount.mockResolvedValue(0);
    await expect(service.create("user-1", DTO)).resolves.toMatchObject({
      verifiedVisit: false,
    });
  });
});
