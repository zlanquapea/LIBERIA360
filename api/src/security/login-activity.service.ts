import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { MoreThanOrEqual, Repository } from "typeorm";
import {
  LoginActivity,
  LoginActivityReason,
} from "./entities/login-activity.entity";
import { RequestInfo } from "../common/request-info";
import { User } from "../users/entities/user.entity";

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
  ) {}

  async record(input: {
    userId: string | null;
    emailAttempted: string;
    success: boolean;
    reason: LoginActivityReason;
    requestInfo?: RequestInfo;
  }): Promise<void> {
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
    } catch (error) {
      this.logger.error(
        `Failed to record login activity: ${(error as Error).message}`,
      );
    }
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
