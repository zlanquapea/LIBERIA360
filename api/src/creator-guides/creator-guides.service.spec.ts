import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { CreatorGuidesService } from "./creator-guides.service";
import { CreatorGuideStatus } from "./entities/creator-guide.enums";
import { CreatorGuide } from "./entities/creator-guide.entity";
import { TripVisibility } from "../itineraries/entities/itinerary.enums";

const CREATOR = {
  id: "creator-1",
  userId: "user-1",
  name: "Ama",
  username: "ama",
  profileImage: null,
  category: "photographer",
  verificationStatus: "verified",
  user: { email: "private@example.com" },
};
const PLACE_A = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "ELWA Beach",
};
const PLACE_B = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Providence Island",
};

function makeGuide(overrides: Partial<CreatorGuide> = {}): CreatorGuide {
  return {
    id: "guide-1",
    creatorId: CREATOR.id,
    creator: CREATOR,
    title: "Beach day",
    slug: "beach-day",
    summary: "A relaxed day on Monrovia's beaches.",
    coverImage: null,
    videoUrl: null,
    stops: [{ placeId: PLACE_A.id, day: 1, note: "Go early" }],
    status: CreatorGuideStatus.DRAFT,
    rejectionReason: null,
    mediaPermissionConfirmedAt: null,
    publishedAt: null,
    reviewedByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as CreatorGuide;
}

describe("CreatorGuidesService", () => {
  let service: CreatorGuidesService;
  let guideRepo: Record<string, jest.Mock>;
  let savedRepo: Record<string, jest.Mock>;
  let creatorRepo: Record<string, jest.Mock>;
  let placeRepo: Record<string, jest.Mock>;
  let itineraryRepo: Record<string, jest.Mock>;
  let notifications: Record<string, jest.Mock>;

  beforeEach(() => {
    guideRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      exists: jest.fn().mockResolvedValue(false),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: "guide-1", ...x })),
      remove: jest.fn(),
    };
    savedRepo = {
      exists: jest.fn().mockResolvedValue(false),
      create: jest.fn((x) => x),
      save: jest.fn(),
      delete: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };
    creatorRepo = { findOne: jest.fn().mockResolvedValue(CREATOR) };
    placeRepo = {
      find: jest.fn(async ({ where }) =>
        [PLACE_A, PLACE_B].filter((p) =>
          (where.id._value as string[]).includes(p.id),
        ),
      ),
    };
    itineraryRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: "trip-9", ...x })),
    };
    notifications = { create: jest.fn(), createMany: jest.fn() };
    const users = { findAdminIds: jest.fn().mockResolvedValue(["admin-1"]) };
    service = new CreatorGuidesService(
      guideRepo as never,
      savedRepo as never,
      creatorRepo as never,
      placeRepo as never,
      itineraryRepo as never,
      notifications as never,
      users as never,
    );
  });

  it("requires a creator profile to write guides", async () => {
    creatorRepo.findOne.mockResolvedValue(null);
    await expect(service.listMine("user-2")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("creates a draft with only catalog places, dropping duplicates", async () => {
    const view = await service.create("user-1", {
      title: " Beach day ",
      summary: "A relaxed day on Monrovia's beaches.",
      stops: [
        { placeId: PLACE_A.id, day: 1, note: " Go early " },
        { placeId: PLACE_A.id, day: 2 },
      ],
    });
    expect(guideRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Beach day",
        slug: "beach-day",
        status: CreatorGuideStatus.DRAFT,
        stops: [{ placeId: PLACE_A.id, day: 1, note: "Go early" }],
      }),
    );
    expect(view.creator).not.toHaveProperty("user");
  });

  it("rejects places that aren't approved catalog places", async () => {
    await expect(
      service.create("user-1", {
        title: "Beach day",
        summary: "A relaxed day on Monrovia's beaches.",
        stops: [{ placeId: "33333333-3333-4333-8333-333333333333", day: 1 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("won't submit media without the permission confirmation", async () => {
    guideRepo.findOne.mockResolvedValue(
      makeGuide({ coverImage: "/uploads/cover.jpg" }),
    );
    await expect(service.submit("user-1", "guide-1")).rejects.toThrow(
      /right to share/,
    );
  });

  it("submits for review and alerts admins", async () => {
    guideRepo.findOne.mockResolvedValue(makeGuide());
    const view = await service.submit("user-1", "guide-1");
    expect(view.status).toBe(CreatorGuideStatus.PENDING_REVIEW);
    expect(notifications.createMany).toHaveBeenCalledWith(
      ["admin-1"],
      expect.objectContaining({ type: "admin.guide_pending_review" }),
    );
  });

  it("hides another creator's guide behind a 404", async () => {
    guideRepo.findOne.mockResolvedValue(makeGuide({ creatorId: "other" }));
    await expect(
      service.update("user-1", "guide-1", { title: "Mine now" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("sends an edited published guide back for review, and clears the media tick when media changes", async () => {
    guideRepo.findOne.mockResolvedValue(
      makeGuide({
        status: CreatorGuideStatus.PUBLISHED,
        coverImage: "/uploads/a.jpg",
        mediaPermissionConfirmedAt: new Date(),
      }),
    );
    await expect(
      service.update("user-1", "guide-1", { coverImage: "/uploads/b.jpg" }),
    ).rejects.toThrow(/right to share/);

    guideRepo.findOne.mockResolvedValue(
      makeGuide({ status: CreatorGuideStatus.PUBLISHED }),
    );
    const view = await service.update("user-1", "guide-1", {
      summary: "An updated, still relaxed beach day.",
    });
    expect(view.status).toBe(CreatorGuideStatus.PENDING_REVIEW);
    expect(notifications.createMany).toHaveBeenCalled();
  });

  it("requires a reason to decline, and notifies the creator either way", async () => {
    guideRepo.findOne.mockResolvedValue(
      makeGuide({ status: CreatorGuideStatus.PENDING_REVIEW }),
    );
    await expect(
      service.review("admin-1", "guide-1", { approve: false }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const view = await service.review("admin-1", "guide-1", { approve: true });
    expect(view.status).toBe(CreatorGuideStatus.PUBLISHED);
    expect(view.publishedAt).toBeInstanceOf(Date);
    expect(notifications.create).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        type: "guide.review_decided",
        link: "/creator-guides/beach-day",
      }),
    );
  });

  it("only reviews guides that are waiting", async () => {
    guideRepo.findOne.mockResolvedValue(makeGuide());
    await expect(
      service.review("admin-1", "guide-1", { approve: true }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("can't save an unpublished guide", async () => {
    guideRepo.findOne.mockResolvedValue(null);
    await expect(service.save("user-2", "guide-1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("copies a published guide into a private trip, day by day", async () => {
    guideRepo.findOne.mockResolvedValue(
      makeGuide({
        status: CreatorGuideStatus.PUBLISHED,
        stops: [
          { placeId: PLACE_A.id, day: 1, note: "Go early" },
          { placeId: PLACE_B.id, day: 3, note: null },
        ],
      }),
    );
    const { id } = await service.useAsTrip("user-2", "guide-1");
    expect(id).toBe("trip-9");
    expect(itineraryRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-2",
        durationDays: 2,
        visibility: TripVisibility.PRIVATE,
        stops: [
          { day: 1, order: 0, placeId: PLACE_A.id, notes: "Go early" },
          { day: 2, order: 0, placeId: PLACE_B.id, notes: null },
        ],
        description: expect.stringContaining("by Ama"),
      }),
    );
  });
});
