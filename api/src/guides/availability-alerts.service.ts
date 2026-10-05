import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { assertGuideDate, defaultAvailability } from "./availability";

@Injectable()
export class AvailabilityAlertsService
  implements OnModuleInit, OnModuleDestroy
{
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly logger = new Logger(AvailabilityAlertsService.name);
  constructor(private readonly db: DataSource) {}
  onModuleInit() {
    void this.processAlerts();
    this.timer = setInterval(() => void this.processAlerts(), 60000);
    this.timer.unref?.();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async isAvailable(
    manager: EntityManager,
    experienceId: string,
    date: string,
  ) {
    const rows = await manager.query(
      `SELECT e.title, g.id AS guide_id, g.user_id, g.availability FROM experiences e JOIN guide_profiles g ON g.id = e.guide_id WHERE e.id = $1 AND e.status = 'published' AND g.verification_status = 'verified'`,
      [experienceId],
    );
    if (!rows.length)
      throw new NotFoundException("Published experience not found.");
    const guide = rows[0];
    const bookings = await manager.query(
      `SELECT b.id FROM guide_bookings b JOIN experiences e ON e.id = b.experience_id WHERE e.guide_id = $1 AND b.requested_date = $2::date AND b.status = 'confirmed' LIMIT 1`,
      [guide.guide_id, date],
    );
    try {
      assertGuideDate(
        date,
        guide.availability ?? defaultAvailability,
        bookings.length ? [date] : [],
      );
      return { ...guide, available: true };
    } catch (error) {
      if (error instanceof ConflictException)
        return { ...guide, available: false };
      throw error;
    }
  }
  list(userId: string) {
    return this.db.query(
      `SELECT w.id, w.experience_id AS "experienceId", w.requested_date::text AS date, e.title, w.notified_at AS "notifiedAt" FROM guide_availability_alerts w JOIN experiences e ON e.id = w.experience_id WHERE w.user_id = $1 AND w.requested_date >= (NOW() AT TIME ZONE 'UTC')::date ORDER BY w.created_at DESC LIMIT 100`,
      [userId],
    );
  }
  async subscribe(userId: string, experienceId: string, date: string) {
    // Validate the calendar date before querying a PostgreSQL date column.
    assertGuideDate(date, defaultAvailability);
    const today = new Date().toISOString().slice(0, 10);
    if (new Date(date).getTime() - new Date(today).getTime() > 365 * 86400000)
      throw new BadRequestException("Choose a date within the next year.");
    return this.db.transaction(async (manager) => {
      // Serialize this user's limit checks and subscriptions.
      await manager.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [
        userId,
      ]);
      const guide = await this.isAvailable(manager, experienceId, date);
      if (guide.user_id === userId)
        throw new BadRequestException("You cannot watch your own experience.");
      if (guide.available)
        throw new ConflictException(
          "This date is already available. Refresh availability and request a booking.",
        );
      const active = await manager.query(
        `SELECT id, experience_id, requested_date::text AS date FROM guide_availability_alerts WHERE user_id = $1 AND notified_at IS NULL AND requested_date >= (NOW() AT TIME ZONE 'UTC')::date`,
        [userId],
      );
      if (
        active.some(
          (row: { experience_id: string; date: string }) =>
            row.experience_id === experienceId && row.date === date,
        )
      )
        return { watching: true };
      if (active.length >= 20)
        throw new BadRequestException(
          "You can watch up to 20 dates. Remove an alert in Account settings first.",
        );
      await manager.query(
        `INSERT INTO guide_availability_alerts (user_id, experience_id, requested_date) VALUES ($1, $2, $3::date) ON CONFLICT (user_id, experience_id, requested_date) DO UPDATE SET notified_at = NULL, checked_at = NOW(), created_at = NOW()`,
        [userId, experienceId, date],
      );
      return { watching: true };
    });
  }
  async remove(userId: string, id: string) {
    await this.db.query(
      "DELETE FROM guide_availability_alerts WHERE id = $1 AND user_id = $2",
      [id, userId],
    );
    return { removed: true };
  }

  async processAlerts() {
    if (this.running) return;
    this.running = true;
    try {
      await this.db.transaction(async (manager) => {
        // Fair rotation for unavailable dates; row locks make multiple API instances safe.
        const alerts = await manager.query(
          `SELECT id, user_id, experience_id, requested_date::text AS date FROM guide_availability_alerts WHERE notified_at IS NULL AND requested_date >= (NOW() AT TIME ZONE 'UTC')::date ORDER BY checked_at, id LIMIT 100 FOR UPDATE SKIP LOCKED`,
        );
        for (const alert of alerts) {
          await manager.query(
            "UPDATE guide_availability_alerts SET checked_at = NOW() WHERE id = $1",
            [alert.id],
          );
          let availability;
          try {
            availability = await this.isAvailable(
              manager,
              alert.experience_id,
              alert.date,
            );
          } catch (error) {
            if (
              error instanceof NotFoundException ||
              error instanceof BadRequestException
            )
              continue;
            throw error;
          }
          if (!availability.available) continue;
          // Persist the notification and delivery marker atomically: failures retry without duplicates.
          await manager.query(
            `INSERT INTO notifications (id, user_id, type, title, body, link, read) VALUES (gen_random_uuid(), $1, 'booking.availability', 'Your watched date is available', $2, $3, false)`,
            [
              alert.user_id,
              `${availability.title} is available to request on ${alert.date}. Availability can change; guide confirmation is required.`,
              `/experiences/${alert.experience_id}?date=${alert.date}`,
            ],
          );
          await manager.query(
            "UPDATE guide_availability_alerts SET notified_at = NOW() WHERE id = $1",
            [alert.id],
          );
        }
        await manager.query(
          `DELETE FROM guide_availability_alerts WHERE requested_date < (NOW() AT TIME ZONE 'UTC')::date - 30`,
        );
      });
    } catch (error) {
      this.logger.warn(
        "Availability alert check failed; it will retry on the next interval.",
      );
    } finally {
      this.running = false;
    }
  }
}
