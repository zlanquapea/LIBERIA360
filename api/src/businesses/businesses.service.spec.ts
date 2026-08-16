import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { BusinessesService } from "./businesses.service";
import { Business } from "./entities/business.entity";
import { Place } from "../places/entities/place.entity";

const OWNER_ID = "owner-1";
const STRANGER_ID = "stranger-1";
const BUSINESS_ID = "business-1";

describe("BusinessesService.updateMine", () => {
  let service: BusinessesService;
  let businessRepo: {
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    businessRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: BUSINESS_ID,
        ownerUserId: OWNER_ID,
        name: "Comfort Lodge",
        images: [],
      }),
      findOneOrFail: jest.fn((opts) =>
        Promise.resolve({ id: opts.where.id, ownerUserId: OWNER_ID }),
      ),
      save: jest.fn((data) => data),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessesService,
        { provide: getRepositoryToken(Business), useValue: businessRepo },
        { provide: getRepositoryToken(Place), useValue: {} },
      ],
    }).compile();

    service = module.get(BusinessesService);
  });

  it("404s an unknown business", async () => {
    businessRepo.findOne.mockResolvedValue(null);
    await expect(
      service.updateMine(OWNER_ID, BUSINESS_ID, { name: "New name" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("403s a user who doesn't own the business", async () => {
    await expect(
      service.updateMine(STRANGER_ID, BUSINESS_ID, { name: "New name" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(businessRepo.save).not.toHaveBeenCalled();
  });

  it("lets the owner update their listing's photos", async () => {
    const images = ["/uploads/a.jpg", "/uploads/b.jpg"];
    await service.updateMine(OWNER_ID, BUSINESS_ID, { images });
    expect(businessRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ images }),
    );
  });

  it("lets the owner update contact fields without touching images", async () => {
    await service.updateMine(OWNER_ID, BUSINESS_ID, {
      phone: "+231770000000",
    });
    expect(businessRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "+231770000000", images: [] }),
    );
  });
});
