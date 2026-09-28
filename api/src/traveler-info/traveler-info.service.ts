import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TravelerInfoSettings } from "./entities/traveler-info-settings.entity";
import { UpdateTravelerInfoDto } from "./dto/update-traveler-info.dto";

const SINGLETON_ID = 1;

@Injectable()
export class TravelerInfoService {
  constructor(
    @InjectRepository(TravelerInfoSettings)
    private readonly repo: Repository<TravelerInfoSettings>,
  ) {}

  /** GET /traveler-info — public. Materializes the singleton row with
   * every field null on first read ever, same convention as
   * SettingsService.getApplicationSettings, so /travel-info renders its
   * all-fields-null "nothing set yet" state rather than erroring before
   * any admin has touched this. */
  async get(): Promise<TravelerInfoSettings> {
    const existing = await this.repo.findOne({ where: { id: SINGLETON_ID } });
    if (existing) return existing;
    return this.repo.save(this.repo.create({ id: SINGLETON_ID }));
  }

  async update(
    dto: UpdateTravelerInfoDto,
    actingUserId: string,
  ): Promise<TravelerInfoSettings> {
    const current = await this.get();
    Object.assign(current, dto, { updatedByUserId: actingUserId });
    return this.repo.save(current);
  }
}
