import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ReviewsService } from "./reviews.service";
import { Review } from "./entities/review.entity";
import { Place } from "../places/entities/place.entity";
import { Creator } from "../creators/entities/creator.entity";
import { CarListing } from "../car-listings/entities/car-listing.entity";
import { Booking } from "../bookings/entities/booking.entity";
import { BookingStatus } from "../bookings/entities/booking.enums";

const DTO = { placeId: "place-1", overallRating: 5 };
const CREATOR_DTO = { creatorId: "creator-1", overallRating: 5 };
const CAR_LISTING_DTO = { carListingId: "car-1", overallRating: 5 };

describe("ReviewsService", () => {
  let service: ReviewsService;
  let reviewRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    findOneOrFail: jest.Mock;
    createQueryBuilder: jest.Mock;
    delete: jest.Mock;
    findAndCount: jest.Mock;
  };
  let placeRepo: { findOne: jest.Mock; update: jest.Mock };
  let creatorRepo: { findOne: jest.Mock; update: jest.Mock };
  let carListingRepo: { findOne: jest.Mock; update: jest.Mock };
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
      delete: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    placeRepo = {
      findOne: jest.fn().mockResolvedValue({ id: "place-1" }),
      update: jest.fn(),
    };
    creatorRepo = {
      findOne: jest.fn().mockResolvedValue({ id: "creator-1" }),
      update: jest.fn(),
    };
    carListingRepo = {
      findOne: jest.fn().mockResolvedValue({ id: "car-1" }),
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
        { provide: getRepositoryToken(Creator), useValue: creatorRepo },
        { provide: getRepositoryToken(CarListing), useValue: carListingRepo },
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
      ],
    }).compile();

    service = module.get(ReviewsService);
  });

  it("rejects a review with neither placeId nor creatorId", async () => {
    await expect(
      service.create("user-1", { overallRating: 5 } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a review with both placeId and creatorId", async () => {
    await expect(
      service.create("user-1", { ...DTO, creatorId: "creator-1" }),
    ).rejects.toBeInstanceOf(BadRequestException);
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

  describe("creator reviews", () => {
    it("rejects a review for a creator that doesn't exist", async () => {
      creatorRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create("user-1", CREATOR_DTO),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rejects a duplicate review for the same creator", async () => {
      reviewRepo.findOne.mockResolvedValue({ id: "existing" });
      await expect(
        service.create("user-1", CREATOR_DTO),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(reviewRepo.save).not.toHaveBeenCalled();
    });

    it("creates an unverified review and recalculates the creator's rating", async () => {
      const result = await service.create("user-1", CREATOR_DTO);
      expect(result.verifiedVisit).toBe(false);
      expect(creatorRepo.update).toHaveBeenCalledWith(
        "creator-1",
        expect.objectContaining({ rating: 5, reviewCount: 1 }),
      );
    });
  });

  describe("car listing reviews", () => {
    it("rejects a review for a car listing that doesn't exist", async () => {
      carListingRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create("user-1", CAR_LISTING_DTO),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rejects a duplicate review for the same car listing", async () => {
      reviewRepo.findOne.mockResolvedValue({ id: "existing" });
      await expect(
        service.create("user-1", CAR_LISTING_DTO),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(reviewRepo.save).not.toHaveBeenCalled();
    });

    it("marks verifiedVisit true when the reviewer has a confirmed booking for that car", async () => {
      bookingQueryBuilder.getCount.mockResolvedValue(1);
      const result = await service.create("user-1", CAR_LISTING_DTO);
      expect(result.verifiedVisit).toBe(true);
      expect(bookingQueryBuilder.andWhere).toHaveBeenCalledWith(
        "booking.carListingId = :matchValue",
        { matchValue: "car-1" },
      );
    });

    it("leaves verifiedVisit false and recalculates the listing's rating when there's no confirmed booking", async () => {
      bookingQueryBuilder.getCount.mockResolvedValue(0);
      const result = await service.create("user-1", CAR_LISTING_DTO);
      expect(result.verifiedVisit).toBe(false);
      expect(carListingRepo.update).toHaveBeenCalledWith(
        "car-1",
        expect.objectContaining({ rating: 5, reviewCount: 1 }),
      );
    });
  });

  describe("remove", () => {
    it("rejects an unknown review", async () => {
      reviewRepo.findOne.mockResolvedValue(null);
      await expect(service.remove("nonexistent")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(reviewRepo.delete).not.toHaveBeenCalled();
    });

    it("deletes the review and recalculates the place's rating", async () => {
      reviewRepo.findOne.mockResolvedValue({
        id: "review-1",
        placeId: "place-1",
        creatorId: null,
      });
      await service.remove("review-1");
      expect(reviewRepo.delete).toHaveBeenCalledWith({ id: "review-1" });
      expect(placeRepo.update).toHaveBeenCalledWith(
        "place-1",
        expect.objectContaining({ rating: 5, reviewCount: 1 }),
      );
    });

    it("deletes a creator review and recalculates the creator's rating", async () => {
      reviewRepo.findOne.mockResolvedValue({
        id: "review-1",
        placeId: null,
        creatorId: "creator-1",
      });
      await service.remove("review-1");
      expect(reviewRepo.delete).toHaveBeenCalledWith({ id: "review-1" });
      expect(creatorRepo.update).toHaveBeenCalledWith(
        "creator-1",
        expect.objectContaining({ rating: 5, reviewCount: 1 }),
      );
    });

    it("deletes a car listing review and recalculates the listing's rating", async () => {
      reviewRepo.findOne.mockResolvedValue({
        id: "review-1",
        placeId: null,
        creatorId: null,
        carListingId: "car-1",
      });
      await service.remove("review-1");
      expect(reviewRepo.delete).toHaveBeenCalledWith({ id: "review-1" });
      expect(carListingRepo.update).toHaveBeenCalledWith(
        "car-1",
        expect.objectContaining({ rating: 5, reviewCount: 1 }),
      );
    });
  });

  describe("find", () => {
    it("rejects a query with neither placeId nor creatorId", async () => {
      await expect(service.find({} as never)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("rejects a query with both placeId and creatorId", async () => {
      await expect(
        service.find({ placeId: "place-1", creatorId: "creator-1" } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects a query with both placeId and carListingId", async () => {
      await expect(
        service.find({ placeId: "place-1", carListingId: "car-1" } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("queries by carListingId alone", async () => {
      await service.find({ carListingId: "car-1" } as never);
      expect(reviewRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { carListingId: "car-1" } }),
      );
    });
  });
});
