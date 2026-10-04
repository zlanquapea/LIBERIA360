import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { SafetyReportDto } from "./safety.dto";

@Injectable()
export class SafetyService {
  constructor(private readonly db: DataSource) {}

  async assertCanContact(
    userId: string,
    targets: Array<string | null | undefined>,
  ) {
    const ids = [
      ...new Set(targets.filter((id): id is string => !!id && id !== userId)),
    ];
    if (!ids.length) return;
    const rows = await this.db.query(
      `SELECT 1 FROM user_blocks WHERE (blocker_id = $1 AND blocked_user_id = ANY($2::uuid[])) OR (blocked_user_id = $1 AND blocker_id = ANY($2::uuid[])) LIMIT 1`,
      [userId, ids],
    );
    if (rows.length)
      throw new ForbiddenException(
        "Messaging is unavailable between these accounts.",
      );
  }

  async assertConversation(userId: string, conversationId: string) {
    const rows = await this.db.query(
      "SELECT user_id FROM conversation_participants WHERE conversation_id = $1",
      [conversationId],
    );
    await this.assertCanContact(
      userId,
      rows.map((row: { user_id: string }) => row.user_id),
    );
  }

  listBlocks(userId: string) {
    return this.db.query(
      "SELECT b.blocked_user_id AS id, u.name FROM user_blocks b JOIN users u ON u.id = b.blocked_user_id WHERE b.blocker_id = $1 ORDER BY b.created_at DESC",
      [userId],
    );
  }

  async block(userId: string, targetId: string) {
    if (userId === targetId)
      throw new BadRequestException("You cannot block yourself.");
    const users = await this.db.query("SELECT id FROM users WHERE id = $1", [
      targetId,
    ]);
    if (!users.length) throw new NotFoundException("Account not found");
    await this.db.query(
      "INSERT INTO user_blocks (blocker_id, blocked_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [userId, targetId],
    );
    return { blocked: true };
  }

  async blockCreator(userId: string, creatorId: string) {
    const rows = await this.db.query(
      "SELECT user_id FROM creators WHERE id = $1",
      [creatorId],
    );
    if (!rows.length) throw new NotFoundException("Creator not found");
    return this.block(userId, rows[0].user_id);
  }

  async unblock(userId: string, targetId: string) {
    await this.db.query(
      "DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_user_id = $2",
      [userId, targetId],
    );
    return { blocked: false };
  }

  async report(userId: string, dto: SafetyReportDto) {
    let rows: Array<{
      text: string;
      media_url?: string;
      attachments?: unknown;
    }>;
    if (dto.targetType === "creator_post") {
      rows = await this.db.query(
        "SELECT caption AS text, media_url FROM creator_posts WHERE id = $1 AND status = 'published'",
        [dto.targetId],
      );
    } else {
      // The join enforces membership before any private text is read or copied.
      rows = await this.db.query(
        `SELECT m.body AS text, m.attachments FROM conversation_messages m JOIN conversation_participants p ON p.conversation_id = m.conversation_id AND p.user_id = $2 WHERE m.id = $1 AND m.deleted_at IS NULL`,
        [dto.targetId, userId],
      );
    }
    if (!rows.length)
      throw new NotFoundException("Content is unavailable to report.");
    await this.db.query(
      `INSERT INTO safety_reports (reporter_id, target_type, target_id, reason, details, snapshot) VALUES ($1, $2, $3, $4, $5, $6::jsonb) ON CONFLICT (reporter_id, target_type, target_id) DO NOTHING`,
      [
        userId,
        dto.targetType,
        dto.targetId,
        dto.reason,
        dto.details?.trim() || null,
        JSON.stringify(rows[0]),
      ],
    );
    return { received: true };
  }

  async queue(status: "open" | "reviewed", page: number) {
    const reviewed = status === "reviewed";
    const rows = await this.db.query(
      `SELECT id, target_type AS "targetType", target_id AS "targetId", reason, details, snapshot, created_at AS "createdAt", reviewed_at AS "reviewedAt", action FROM safety_reports WHERE (reviewed_at IS NOT NULL) = $1 ORDER BY created_at DESC, id DESC LIMIT 21 OFFSET $2`,
      [reviewed, (page - 1) * 20],
    );
    return { data: rows.slice(0, 20), hasMore: rows.length > 20, page };
  }

  async review(adminId: string, id: string, action: "dismiss" | "hide") {
    return this.db.transaction(async (manager: EntityManager) => {
      const rows = await manager.query(
        "SELECT * FROM safety_reports WHERE id = $1 FOR UPDATE",
        [id],
      );
      const report = rows[0];
      if (!report) throw new NotFoundException("Report not found");
      if (report.reviewed_at)
        throw new ConflictException("This report has already been reviewed.");
      if (action === "hide") {
        if (report.target_type === "creator_post") {
          await manager.query(
            "UPDATE creator_posts SET status = 'hidden' WHERE id = $1",
            [report.target_id],
          );
        } else {
          await manager.query(
            "UPDATE conversation_messages SET body = 'This message was removed by moderation', attachments = '[]'::jsonb, deleted_at = COALESCE(deleted_at, NOW()) WHERE id = $1",
            [report.target_id],
          );
        }
      }
      // Keep the reported snapshot and reviewer/action as the audit record.
      await manager.query(
        "UPDATE safety_reports SET reviewed_at = NOW(), reviewed_by = $2, action = $3 WHERE id = $1",
        [id, adminId, action],
      );
      return { reviewed: true };
    });
  }
}
