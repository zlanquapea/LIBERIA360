import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AdminAction } from "./entities/admin-action.entity";

export interface PaginatedAdminActions {
  data: AdminAction[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Accountability log for the handful of admin actions sensitive enough to
 * need a "who did this and when" trail — see AdminAction's own doc
 * comment for which ones and why. log() never blocks or fails the action
 * it's recording: a logging failure (a DB hiccup, say) shouldn't turn a
 * successful admin action into a 500, so this only ever logs its own
 * errors, never rethrows.
 */
@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(
    @InjectRepository(AdminAction)
    private readonly actionRepo: Repository<AdminAction>,
  ) {}

  async log(
    adminUserId: string,
    action: string,
    targetType: string,
    targetId: string | null,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.actionRepo.save(
        this.actionRepo.create({
          adminUserId,
          action,
          targetType,
          targetId,
          metadata: metadata ?? null,
        }),
      );
    } catch (error) {
      this.logger.error(
        `Failed to record admin action "${action}": ${(error as Error).message}`,
      );
    }
  }

  async findAll(page: number, limit: number): Promise<PaginatedAdminActions> {
    const [data, total] = await this.actionRepo.findAndCount({
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
}
