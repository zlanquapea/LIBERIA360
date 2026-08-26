import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ApplicationSettings } from "./entities/application-settings.entity";

// The one and only row — see ApplicationSettings's doc comment for why
// this is a singleton rather than a generic key-value table.
const SINGLETON_ID = 1;

export type UpdateApplicationSettingsInput = Partial<
  Pick<
    ApplicationSettings,
    | "freshnessFlagThreshold"
    | "freshnessWindowDays"
    | "reportFlagThreshold"
    | "reportWindowDays"
    | "failedLoginAlertThreshold1h"
    | "failedLoginAlertThreshold24h"
  >
>;

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(ApplicationSettings)
    private readonly repo: Repository<ApplicationSettings>,
  ) {}

  /** Every threshold-reading call site (AdminService's moderation queue,
   * LoginActivityService's alerting) goes through this instead of a
   * hardcoded constant. Materializes the singleton row with column
   * defaults on first read ever, so a brand-new deploy behaves exactly
   * like the old hardcoded constants did until a super admin changes
   * something. */
  async getApplicationSettings(): Promise<ApplicationSettings> {
    const existing = await this.repo.findOne({
      where: { id: SINGLETON_ID },
    });
    if (existing) return existing;
    return this.repo.save(this.repo.create({ id: SINGLETON_ID }));
  }

  async updateApplicationSettings(
    input: UpdateApplicationSettingsInput,
    actingUserId: string,
  ): Promise<ApplicationSettings> {
    const current = await this.getApplicationSettings();
    Object.assign(current, input, { updatedByUserId: actingUserId });
    return this.repo.save(current);
  }
}
