import { Test, TestingModule } from "@nestjs/testing";
import { AdvertisementsController } from "./advertisements.controller";
import { AdvertisementsService } from "./advertisements.service";

// Security audit (Sep 4, 2026 — CVSS 8.6): the pentest's headline finding
// — GET /advertisements/active leaking the owner's email,
// isAdmin/isSuperAdmin flags, and 2FA status to an anonymous visitor.
// This asserts the fix at the boundary that actually matters: the JSON
// this controller hands back, not just that some internal sanitize
// function exists.
describe("AdvertisementsController — public routes never leak owner PII", () => {
  let controller: AdvertisementsController;
  let service: { findActive: jest.Mock; findActiveOne: jest.Mock };

  const fullOwner = {
    id: "owner-1",
    name: "Emmanuel",
    email: "zemmanuelweh@gmail.com",
    phone: "+231777777690",
    authProvider: "email",
    homeCounty: null,
    isAdmin: true,
    isSuperAdmin: true,
    travelerType: null,
    interests: [],
    twoFactorEnabled: false,
    emailVerified: true,
    createdAt: new Date("2026-08-19T22:00:19.450Z"),
    pendingActivation: false,
    passwordHash: "should-never-leave-the-api-either",
  };

  beforeEach(async () => {
    service = {
      findActive: jest
        .fn()
        .mockResolvedValue([
          { id: "ad-1", contactPhone: "+231777777690", owner: fullOwner },
        ]),
      findActiveOne: jest
        .fn()
        .mockResolvedValue({ id: "ad-1", owner: fullOwner }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdvertisementsController],
      providers: [{ provide: AdvertisementsService, useValue: service }],
    }).compile();

    controller = module.get(AdvertisementsController);
  });

  it("GET /advertisements/active strips owner down to {id, name}", async () => {
    const [ad] = await controller.findActive();
    expect(ad.owner).toEqual({ id: "owner-1", name: "Emmanuel" });
  });

  it("GET /advertisements/active/:id strips owner down to {id, name}", async () => {
    const ad = await controller.findActiveOne("ad-1");
    expect(ad.owner).toEqual({ id: "owner-1", name: "Emmanuel" });
  });
});
