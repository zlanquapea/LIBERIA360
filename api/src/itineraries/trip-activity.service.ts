import { Injectable, NotFoundException } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";

// Called within the same transaction as the action: history and notifications
// either both commit with it or neither does. Never notifies the actor.
export async function recordTripActivity(
  m: EntityManager,
  trip: string,
  actor: string,
  kind: "suggested" | "added",
  title: string,
  target: string,
) {
  await m.query(
    `INSERT INTO trip_activity(trip_id,actor_id,kind,title,target) VALUES($1,$2,$3,$4,$5)`,
    [trip, actor, kind, title.slice(0, 300), target],
  );
  await m.query(
    `INSERT INTO notifications(user_id,type,title,body,link,read)
    SELECT members.user_id,'trip.activity',$3,$4,$5,false FROM (
      SELECT user_id FROM itineraries WHERE id=$1 UNION SELECT user_id FROM itinerary_collaborators WHERE itinerary_id=$1
    ) members
    WHERE members.user_id<>$2 AND NOT EXISTS (
      SELECT 1 FROM trip_activity_preferences p WHERE p.trip_id=$1 AND p.user_id=members.user_id AND p.muted=true
    )`,
    [
      trip,
      actor,
      kind === "suggested" ? "New trip suggestion" : "Trip itinerary updated",
      `${title.slice(0, 300)} ${kind === "suggested" ? "was suggested for your trip. Cast your vote." : "was added to your itinerary."}`,
      `/trips/${trip}#${target}`,
    ],
  );
}

@Injectable()
export class TripActivityService {
  constructor(private readonly db: DataSource) {}
  private async access(m: EntityManager, user: string, trip: string) {
    const rows = await m.query(
      `SELECT id FROM itineraries WHERE id=$1 AND (user_id=$2 OR EXISTS(SELECT 1 FROM itinerary_collaborators WHERE itinerary_id=$1 AND user_id=$2))`,
      [trip, user],
    );
    if (!rows.length) throw new NotFoundException("Trip not found");
  }
  async list(user: string, trip: string, page: number) {
    await this.access(this.db.manager, user, trip);
    const rows = await this.db.query(
      `SELECT a.id,a.kind,a.title,a.target,a.created_at AS "createdAt",COALESCE(u.name,'A trip member') AS actor FROM trip_activity a LEFT JOIN users u ON u.id=a.actor_id WHERE a.trip_id=$1 ORDER BY a.created_at DESC,a.id DESC LIMIT 21 OFFSET $2`,
      [trip, page * 20],
    );
    const [pref] = await this.db.query(
      "SELECT muted FROM trip_activity_preferences WHERE trip_id=$1 AND user_id=$2",
      [trip, user],
    );
    return {
      items: rows.slice(0, 20),
      hasMore: rows.length > 20,
      muted: pref?.muted ?? false,
    };
  }
  async mute(user: string, trip: string, muted: boolean) {
    return this.db.transaction(async (m) => {
      await this.access(m, user, trip);
      await m.query(
        `INSERT INTO trip_activity_preferences(trip_id,user_id,muted) VALUES($1,$2,$3) ON CONFLICT(trip_id,user_id) DO UPDATE SET muted=EXCLUDED.muted`,
        [trip, user, muted],
      );
      return { muted };
    });
  }
}
