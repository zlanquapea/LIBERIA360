import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { MoreThanOrEqual, Repository } from "typeorm";
import {
  LoginActivity,
  LoginActivityReason,
} from "./entities/login-activity.entity";
import { RequestInfo } from "../common/request-info";
import { User } from "../users/entities/user.entity";
import { MailService } from "../mail/mail.service";
import { AppConfig } from "../config/configuration";
import { SettingsService } from "../settings/settings.service";

export interface PaginatedLoginActivity {
  data: LoginActivity[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface SecurityOverview {
  failedLoginsLast1h: number;
  failedLoginsLast24h: number;
  distinctFailingIpsLast24h: number;
  adminTwoFactorAdoption: {
    total: number;
    enabled: number;
  };
}

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

/** Records and queries every completed login attempt — see
 * LoginActivity's own doc comment for exactly what counts as one. Follows
 * the same "never blocks or fails the calling action" contract as
 * AdminAuditService.log: a logging hiccup here should never turn a real
 * login into a 500. */
@Injectable()
export class LoginActivityService {
  private readonly logger = new Logger(LoginActivityService.name);

  constructor(
    @InjectRepository(LoginActivity)
    private readonly activityRepo: Repository<LoginActivity>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly mailService: MailService,
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly settingsService: SettingsService,
  ) {}

  async record(input: {
    userId: string | null;
    emailAttempted: string;
    success: boolean;
    reason: LoginActivityReason;
    requestInfo?: RequestInfo;
  }): Promise<void> {
    let saved = false;
    try {
      await this.activityRepo.save(
        this.activityRepo.create({
          userId: input.userId,
          emailAttempted: input.emailAttempted.toLowerCase(),
          success: input.success,
          reason: input.reason,
          ipAddress: input.requestInfo?.ipAddress ?? null,
          userAgent: input.requestInfo?.userAgent ?? null,
        }),
      );
      saved = true;
    } catch (error) {
      this.logger.error(
        `Failed to record login activity: ${(error as Error).message}`,
      );
    }

    // Only worth checking once we know this attempt is actually in the
    // table — checking against a count that doesn't include the row we
    // just tried to save would risk firing on stale data.
    if (saved && !input.success) {
      await this.alertOnThresholdCrossing().catch((error) => {
        this.logger.error(
          `Failed to check failed-login alert thresholds: ${(error as Error).message}`,
        );
      });
    }
  }

  /** Fires an email to every super admin the *instant* a failed-login
   * count first exceeds a threshold — not on every attempt after that,
   * which would spam a super admin's inbox for as long as the attack
   * continues. The two windows are checked independently (both can fire
   * on the same call): a fast/loud attempt trips the 1h threshold
   * quickly, while a slow/quiet one that stays under it can still trip
   * the 24h one. Thresholds come from Settings > Application
   * (failedLoginAlertThreshold1h/24h) rather than a hardcoded constant —
   * see ApplicationSettings's doc comment for the defaults, which match
   * what this used to hardcode. */
  private async alertOnThresholdCrossing(): Promise<void> {
    const now = Date.now();
    const [count1h, count24h, settings] = await Promise.all([
      this.activityRepo.count({
        where: {
          success: false,
          createdAt: MoreThanOrEqual(new Date(now - ONE_HOUR_MS)),
        },
      }),
      this.activityRepo.count({
        where: {
          success: false,
          createdAt: MoreThanOrEqual(new Date(now - ONE_DAY_MS)),
        },
      }),
      this.settingsService.getApplicationSettings(),
    ]);

    if (count1h === settings.failedLoginAlertThreshold1h + 1) {
      await this.emailSuperAdmins(count1h, "hour");
    }
    if (count24h === settings.failedLoginAlertThreshold24h + 1) {
      await this.emailSuperAdmins(count24h, "24 hours");
    }
  }

  private async emailSuperAdmins(
    count: number,
    windowLabel: string,
  ): Promise<void> {
    const superAdmins = await this.userRepo.find({
      where: { isSuperAdmin: true },
    });
    if (superAdmins.length === 0) return;

    const webAppUrl = this.configService.get("webAppUrl", { infer: true });
    const securityUrl = `${webAppUrl}/admin/security/alerts`;
    await Promise.all(
      superAdmins.map((admin) =>
        this.mailService
          .sendFailedLoginAlert(
            admin.email,
            admin.name,
            count,
            windowLabel,
            securityUrl,
          )
          .catch(() => undefined),
      ),
    );
  }

  async findAll(
    page: number,
    limit: number,
    onlyFailed?: boolean,
  ): Promise<PaginatedLoginActivity> {
    const [data, total] = await this.activityRepo.findAndCount({
      where: onlyFailed ? { success: false } : {},
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  /** The numbers a super admin's Security page leads with — brute-force
   * signal (failed logins, and how many distinct IPs they're spread
   * across) plus how well-protected the admin team itself is. */
  async getOverview(): Promise<SecurityOverview> {
    const now = Date.now();
    const [
      failedLoginsLast1h,
      failedLoginsLast24h,
      failingRowsLast24h,
      adminUsers,
    ] = await Promise.all([
      this.activityRepo.count({
        where: {
          success: false,
          createdAt: MoreThanOrEqual(new Date(now - ONE_HOUR_MS)),
        },
      }),
      this.activityRepo.count({
        where: {
          success: false,
          createdAt: MoreThanOrEqual(new Date(now - ONE_DAY_MS)),
        },
      }),
      this.activityRepo.find({
        where: {
          success: false,
          createdAt: MoreThanOrEqual(new Date(now - ONE_DAY_MS)),
        },
        select: ["ipAddress"],
      }),
      this.userRepo
        .createQueryBuilder("user")
        .select("user.twoFactorEnabled", "twoFactorEnabled")
        .where("user.isAdmin = true OR user.isSuperAdmin = true")
        .getRawMany<{ twoFactorEnabled: boolean }>(),
    ]);

    const distinctFailingIps = new Set(
      failingRowsLast24h
        .map((row) => row.ipAddress)
        .filter((ip): ip is string => ip !== null),
    );

    return {
      failedLoginsLast1h,
      failedLoginsLast24h,
      distinctFailingIpsLast24h: distinctFailingIps.size,
      adminTwoFactorAdoption: {
        total: adminUsers.length,
        enabled: adminUsers.filter((u) => u.twoFactorEnabled).length,
      },
    };
  }
}
