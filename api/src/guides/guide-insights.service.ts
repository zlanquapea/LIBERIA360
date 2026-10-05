import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
@Injectable()
export class GuideInsightsService {
  constructor(private readonly db: DataSource) {}
  async record(id: string, guideId?: string, experienceId?: string) {
    if (Boolean(guideId) === Boolean(experienceId))
      throw new BadRequestException("Choose one guide or experience");
    const rows = experienceId
      ? await this.db.query(
          `SELECT g.id FROM experiences e JOIN guide_profiles g ON g.id=e.guide_id WHERE e.id=$1 AND e.status='published' AND g.verification_status='verified'`,
          [experienceId],
        )
      : await this.db.query(
          `SELECT id FROM guide_profiles WHERE id=$1 AND verification_status='verified'`,
          [guideId],
        );
    if (!rows.length)
      throw new NotFoundException("Public profile or experience not found");
    await this.db.query(
      `INSERT INTO guide_view_events(id,guide_id,experience_id) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING`,
      [id, rows[0].id, experienceId ?? null],
    );
  }
  async mine(user: string, days: number) {
    if (![7, 30, 90].includes(days))
      throw new BadRequestException("Choose 7, 30 or 90 days");
    const [guide] = await this.db.query(
      "SELECT id FROM guide_profiles WHERE user_id=$1",
      [user],
    );
    if (!guide) return { available: false };
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - days + 1);
    const [views, bookings, experiences] = await Promise.all([
      this.db.query(
        `SELECT (created_at AT TIME ZONE 'UTC')::date::text AS date,count(*) FILTER(WHERE experience_id IS NULL)::int AS profile_views,count(*) FILTER(WHERE experience_id IS NOT NULL)::int AS experience_views FROM guide_view_events WHERE guide_id=$1 AND created_at >= $2 GROUP BY 1 ORDER BY 1`,
        [guide.id, since],
      ),
      this.db.query(
        `SELECT (b.created_at AT TIME ZONE 'UTC')::date::text AS date,count(*)::int AS booking_requests FROM guide_bookings b JOIN experiences e ON e.id=b.experience_id WHERE e.guide_id=$1 AND b.created_at >= $2 GROUP BY 1 ORDER BY 1`,
        [guide.id, since],
      ),
      this.db.query(
        `SELECT e.id,e.title,(SELECT count(*)::int FROM guide_view_events v WHERE v.experience_id=e.id AND v.created_at >= $2) AS views,(SELECT count(*)::int FROM guide_bookings b WHERE b.experience_id=e.id AND b.created_at >= $2) AS booking_requests FROM experiences e WHERE e.guide_id=$1 ORDER BY views DESC,e.title`,
        [guide.id, since],
      ),
    ]);
    const byDay = Array.from({ length: days }, (_, i) => {
      const d = new Date(since);
      d.setUTCDate(d.getUTCDate() + i);
      const date = d.toISOString().slice(0, 10);
      return {
        date,
        profile_views: 0,
        experience_views: 0,
        booking_requests: 0,
        ...views.find((v: any) => v.date === date),
        ...bookings.find((b: any) => b.date === date),
      };
    });
    const totals = byDay.reduce(
      (a, d) => ({
        profile_views: a.profile_views + d.profile_views,
        experience_views: a.experience_views + d.experience_views,
        booking_requests: a.booking_requests + d.booking_requests,
      }),
      { profile_views: 0, experience_views: 0, booking_requests: 0 },
    );
    return { available: true, days, totals, byDay, experiences };
  }
}
