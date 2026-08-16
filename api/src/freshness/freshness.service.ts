import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PlaceFreshnessReport } from "./entities/place-freshness-report.entity";
import { Place } from "../places/entities/place.entity";
import { CreateFreshnessReportDto } from "./dto/create-freshness-report.dto";

@Injectable()
export class FreshnessService {
  constructor(
    @InjectRepository(PlaceFreshnessReport)
    private readonly reportRepo: Repository<PlaceFreshnessReport>,
    @InjectRepository(Place)
    private readonly placeRepo: Repository<Place>,
  ) {}

  /** Upsert on (userId, placeId) — a changed mind replaces the old report
   * rather than piling up alongside it (see the entity's doc comment for
   * why that matters for the aggregate count admins see). */
  async report(
    userId: string,
    dto: CreateFreshnessReportDto,
  ): Promise<PlaceFreshnessReport> {
    const place = await this.placeRepo.findOne({
      where: { id: dto.placeId },
    });
    if (!place) {
      throw new NotFoundException(`Place "${dto.placeId}" not found`);
    }

    const existing = await this.reportRepo.findOne({
      where: { userId, placeId: dto.placeId },
    });
    if (existing) {
      existing.response = dto.response;
      return this.reportRepo.save(existing);
    }

    return this.reportRepo.save(
      this.reportRepo.create({
        userId,
        placeId: dto.placeId,
        response: dto.response,
      }),
    );
  }

  /** So the frontend can show "you already said X" instead of re-prompting
   * — null if this user has never reported on this place. */
  findMine(
    userId: string,
    placeId: string,
  ): Promise<PlaceFreshnessReport | null> {
    return this.reportRepo.findOne({ where: { userId, placeId } });
  }
}
