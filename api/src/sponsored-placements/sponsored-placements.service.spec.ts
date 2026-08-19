import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { SponsoredPlacementsService } from "./sponsored-placements.service";
import { SponsoredPlacement } from "./entities/sponsored-placement.entity";
import { Place } from "../places/entities/place.entity";
import { AdminAuditService } from "../admin/admin-audit.service";

const DTO = {
  placeId: "place-1",
  startDate: "2026-01-01",
  endDate: "2026-01-31",
};

describe("SponsoredPlacementsService", () => {
  let service: SponsoredPlacementsService;
  let placementRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    findOneOrFail: jest.Mock;
    delete: jest.Mock;
  };
  let placeRepo: { findOne: jest.Mock };
  let adminAuditService: { log: jest.Mock };

  beforeEach(async () => {
    let saved: Record<string, unknown> = {};
    placementRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((data) => {
        saved = { id: "placement-1", ...data };
        return saved;
      }),
      create: jest.fn((data) => data),
      findOneOrFail: jest.fn(() => saved),
      delete: jest.fn(),
    };
    placeRepo = {
      findOne: jest.fn().mockResolvedValue({ id: "place-1" }),
    };
    adminAuditService = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SponsoredPlacementsService,
        {
          provide: getRepositoryToken(SponsoredPlacement),
          useValue: placementRepo,
        },
        { provide: getRepositoryToken(Place), useValue: placeRepo },
        { provide: AdminAuditService, useValue: adminAuditService },
      ],
    }).compile();

    service = module.get(SponsoredPlacementsService);
  });

  describe("create", () => {
    it("rejects an unknown place", async () => {
      placeRepo.findOne.mockResolvedValue(null);
      await expect(service.create("admin-1", DTO)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(placementRepo.save).not.toHaveBeenCalled();
      expect(adminAuditService.log).not.toHaveBeenCalled();
    });

    it("rejects an endDate before startDate", async () => {
      await expect(
        service.create("admin-1", {
          ...DTO,
          startDate: "2026-01-31",
          endDate: "2026-01-01",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(placementRepo.save).not.toHaveBeenCalled();
      expect(adminAuditService.log).not.toHaveBeenCalled();
    });

    it("records the creation in the admin audit log", async () => {
      await service.create("admin-1", DTO);
      expect(adminAuditService.log).toHaveBeenCalledWith(
        "admin-1",
        "sponsored_placement.created",
        "sponsored_placement",
        "placement-1",
        {
          placeId: DTO.placeId,
          startDate: DTO.startDate,
          endDate: DTO.endDate,
        },
        undefined,
      );
    });
  });

  describe("revoke", () => {
    it("rejects an unknown placement", async () => {
      placementRepo.findOne.mockResolvedValue(null);
      await expect(
        service.revoke("admin-1", "nonexistent"),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(placementRepo.delete).not.toHaveBeenCalled();
      expect(adminAuditService.log).not.toHaveBeenCalled();
    });

    it("deletes the placement and records the revocation in the admin audit log", async () => {
      placementRepo.findOne.mockResolvedValue({
        id: "placement-1",
        placeId: "place-1",
      });
      await service.revoke("admin-1", "placement-1");
      expect(placementRepo.delete).toHaveBeenCalledWith({ id: "placement-1" });
      expect(adminAuditService.log).toHaveBeenCalledWith(
        "admin-1",
        "sponsored_placement.revoked",
        "sponsored_placement",
        "placement-1",
        { placeId: "place-1" },
        undefined,
      );
    });
  });
});
