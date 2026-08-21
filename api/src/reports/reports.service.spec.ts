import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ReportsService } from "./reports.service";
import { ContentReport } from "./entities/content-report.entity";
import {
  ReportReason,
  ReportTargetType,
} from "./entities/content-report.enums";
import { Review } from "../reviews/entities/review.entity";
import { Event } from "../events/entities/event.entity";
import { Business } from "../businesses/entities/business.entity";

const DTO = {
  targetType: ReportTargetType.REVIEW,
  targetId: "review-1",
  reason: ReportReason.SPAM,
};

describe("ReportsService", () => {
  let service: ReportsService;
  let reportRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let reviewRepo: { exists: jest.Mock };
  let eventRepo: { exists: jest.Mock };
  let businessRepo: { exists: jest.Mock };

  beforeEach(async () => {
    reportRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((data) => ({ id: "report-1", ...data })),
      create: jest.fn((data) => data),
    };
    reviewRepo = { exists: jest.fn().mockResolvedValue(true) };
    eventRepo = { exists: jest.fn().mockResolvedValue(true) };
    businessRepo = { exists: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: getRepositoryToken(ContentReport), useValue: reportRepo },
        { provide: getRepositoryToken(Review), useValue: reviewRepo },
        { provide: getRepositoryToken(Event), useValue: eventRepo },
        { provide: getRepositoryToken(Business), useValue: businessRepo },
      ],
    }).compile();

    service = module.get(ReportsService);
  });

  it("rejects reporting a review that doesn't exist", async () => {
    reviewRepo.exists.mockResolvedValue(false);
    await expect(service.report("user-1", DTO)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(reportRepo.save).not.toHaveBeenCalled();
  });

  it("rejects reporting an event that doesn't exist", async () => {
    eventRepo.exists.mockResolvedValue(false);
    await expect(
      service.report("user-1", { ...DTO, targetType: ReportTargetType.EVENT }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects reporting a business that doesn't exist", async () => {
    businessRepo.exists.mockResolvedValue(false);
    await expect(
      service.report("user-1", {
        ...DTO,
        targetType: ReportTargetType.BUSINESS,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("creates a new report", async () => {
    const result = await service.report("user-1", DTO);
    expect(reportRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        reporterUserId: "user-1",
        targetType: ReportTargetType.REVIEW,
        targetId: "review-1",
        reason: ReportReason.SPAM,
        details: null,
      }),
    );
    expect(result.id).toBe("report-1");
  });

  it("upserts — a second report from the same user on the same target replaces the first", async () => {
    reportRepo.findOne.mockResolvedValue({
      id: "existing-report",
      reason: ReportReason.SPAM,
      details: null,
    });
    await service.report("user-1", {
      ...DTO,
      reason: ReportReason.INAPPROPRIATE,
      details: "changed my mind",
    });
    expect(reportRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "existing-report",
        reason: ReportReason.INAPPROPRIATE,
        details: "changed my mind",
      }),
    );
    expect(reportRepo.create).not.toHaveBeenCalled();
  });
});
