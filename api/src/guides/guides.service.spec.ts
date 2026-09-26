import { GuidesService } from "./guides.service";
import { GuideMessage } from "./entities/guide-message.entity";
import {
  ExperienceCategory,
  ExperienceGroupType,
  ExperienceStatus,
  GuideVerificationStatus,
} from "./entities/guide.enums";

const GUIDE_ID = "guide-1";
const GUIDE_OWNER_ID = "guide-owner-1";
const TRAVELER_ID = "traveler-1";

function makeMessage(): GuideMessage {
  return {
    id: "message-1",
    guideId: GUIDE_ID,
    visitorId: TRAVELER_ID,
    senderId: TRAVELER_ID,
    body: "Can you help plan a beach trip?",
    readAt: null,
    createdAt: new Date("2026-09-23T00:00:00.000Z"),
    sender: { id: TRAVELER_ID, name: "Traveler" } as GuideMessage["sender"],
    guide: undefined as unknown as GuideMessage["guide"],
    visitor: undefined as unknown as GuideMessage["visitor"],
  };
}

describe("GuidesService guide messaging", () => {
  it("lets the owner load a traveler-initiated conversation before replying", async () => {
    const message = makeMessage();
    const selectQuery = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([message]),
    };
    const updateQuery = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const guideRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: GUIDE_ID,
        userId: GUIDE_OWNER_ID,
      }),
    };
    const messageRepo = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(selectQuery)
        .mockReturnValueOnce(updateQuery),
    };
    const service = new GuidesService(
      guideRepo as never,
      {} as never,
      {} as never,
      {} as never,
      messageRepo as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.getGuideMessages(GUIDE_OWNER_ID, GUIDE_ID),
    ).resolves.toEqual([
      expect.objectContaining({
        visitorId: TRAVELER_ID,
        senderId: TRAVELER_ID,
        body: message.body,
      }),
    ]);
    expect(selectQuery.andWhere).not.toHaveBeenCalled();
    expect(updateQuery.andWhere).toHaveBeenCalledWith("sender_id != :userId", {
      userId: GUIDE_OWNER_ID,
    });
  });
});

describe("GuidesService experience publishing", () => {
  it("saves exactly once and returns a serialized published experience", async () => {
    const guide = {
      id: GUIDE_ID,
      userId: GUIDE_OWNER_ID,
      slug: "sam-gboyah",
      guideType: "tour_guide",
      bio: "A verified local guide.",
      city: "Monrovia",
      county: null,
      languages: ["English"],
      verificationStatus: GuideVerificationStatus.VERIFIED,
      whatsappNumber: null,
      profileImageUrl: null,
    };
    const draft = {
      title: "Monrovia Waterside Walk",
      description: "A guided walk through the historic waterside district.",
      category: ExperienceCategory.CITY,
      county: "Montserrado",
      durationMinutes: 90,
      groupType: ExperienceGroupType.SMALL_GROUP,
      maxGroupSize: 8,
      priceUsd: 25,
      priceLrd: null,
      meetingPointText: "Waterside Market",
      meetingLat: null,
      meetingLng: null,
      includes: ["Local guide"],
      cancellationPolicy: "Free cancellation up to 24 hours before.",
      imageUrls: ["https://example.com/walk.jpg"],
      coverImageUrl: "https://example.com/walk.jpg",
      isFeatured: false,
      status: ExperienceStatus.PUBLISHED,
      guideId: GUIDE_ID,
    };
    const saved = { id: "experience-1", ...draft };
    const guideRepo = {
      findOne: jest.fn().mockResolvedValue(guide),
    };
    const experienceRepo = {
      create: jest.fn().mockReturnValue(saved),
      save: jest.fn().mockResolvedValue(saved),
    };
    const reviewRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest
          .fn()
          .mockResolvedValue({ rating: "0", reviewCount: "0" }),
      }),
    };
    const service = new GuidesService(
      guideRepo as never,
      experienceRepo as never,
      {} as never,
      reviewRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.createExperience(GUIDE_OWNER_ID, draft as never),
    ).resolves.toEqual(
      expect.objectContaining({
        id: "experience-1",
        title: draft.title,
        durationMinutes: 90,
        status: ExperienceStatus.PUBLISHED,
        guide: expect.objectContaining({ id: GUIDE_ID, slug: guide.slug }),
      }),
    );
    expect(experienceRepo.save).toHaveBeenCalledTimes(1);
  });
});
