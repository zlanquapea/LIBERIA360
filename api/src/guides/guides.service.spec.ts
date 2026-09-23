import { GuidesService } from "./guides.service";
import { GuideMessage } from "./entities/guide-message.entity";

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
