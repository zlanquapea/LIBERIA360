import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ContentReport } from "./entities/content-report.entity";
import { ReportTargetType } from "./entities/content-report.enums";
import { Review } from "../reviews/entities/review.entity";
import { Event } from "../events/entities/event.entity";
import { CreateContentReportDto } from "./dto/create-content-report.dto";

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(ContentReport)
    private readonly reportRepo: Repository<ContentReport>,
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
  ) {}

  /** Upsert on (reporterUserId, targetType, targetId) — see the entity's
   * doc comment for why a second report from the same user replaces the
   * first instead of piling up alongside it. */
  async report(
    userId: string,
    dto: CreateContentReportDto,
  ): Promise<ContentReport> {
    await this.assertTargetExists(dto.targetType, dto.targetId);

    const existing = await this.reportRepo.findOne({
      where: {
        reporterUserId: userId,
        targetType: dto.targetType,
        targetId: dto.targetId,
      },
    });
    if (existing) {
      existing.reason = dto.reason;
      existing.details = dto.details ?? null;
      return this.reportRepo.save(existing);
    }

    return this.reportRepo.save(
      this.reportRepo.create({
        reporterUserId: userId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
        details: dto.details ?? null,
      }),
    );
  }

  private async assertTargetExists(
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<void> {
    const exists =
      targetType === ReportTargetType.REVIEW
        ? await this.reviewRepo.exists({ where: { id: targetId } })
        : await this.eventRepo.exists({ where: { id: targetId } });
    if (!exists) {
      throw new NotFoundException(`${targetType} "${targetId}" not found`);
    }
  }
}
