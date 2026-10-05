import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { AddStopDto } from "./dto/add-stop.dto";
import { ItinerariesService } from "./itineraries.service";
import { recordTripActivity } from "./trip-activity.service";
@Injectable()
export class TripVotingService {
  constructor(
    private readonly db: DataSource,
    private readonly trips: ItinerariesService,
  ) {}
  private async access(
    m: EntityManager,
    user: string,
    id: string,
    lock = false,
  ) {
    const [trip] = await m.query(
      `SELECT user_id, duration_days, cancelled_at FROM itineraries WHERE id=$1${lock ? " FOR UPDATE" : ""}`,
      [id],
    );
    if (!trip) throw new NotFoundException("Trip not found");
    if (trip.user_id !== user) {
      const members = await m.query(
        "SELECT 1 FROM itinerary_collaborators WHERE itinerary_id=$1 AND user_id=$2",
        [id, user],
      );
      if (!members.length) throw new NotFoundException("Trip not found");
    }
    return trip;
  }
  async list(user: string, id: string) {
    const trip = await this.access(this.db.manager, user, id);
    const items = await this.db.query(
      `SELECT p.id,p.title,p.input,p.user_id = $2 AS mine,
      (SELECT count(*)::int FROM trip_suggestion_votes v WHERE v.suggestion_id=p.id AND
        (v.user_id=$3 OR EXISTS(SELECT 1 FROM itinerary_collaborators c WHERE c.itinerary_id=$1 AND c.user_id=v.user_id))) AS votes,
      EXISTS(SELECT 1 FROM trip_suggestion_votes v WHERE v.suggestion_id=p.id AND v.user_id=$2) AS voted
      FROM trip_suggestions p WHERE p.trip_id=$1 ORDER BY votes DESC,p.created_at ASC`,
      [id, user, trip.user_id],
    );
    return { items, isOwner: trip.user_id === user };
  }
  async suggest(user: string, id: string, input: AddStopDto) {
    const keys = ["placeId", "eventId", "carListingId"] as const;
    const selected = keys.filter((k) => input[k]);
    if (selected.length !== 1)
      throw new BadRequestException("Choose one place, event or car");
    const key = selected[0];
    const tables = {
      placeId: ["places", "name"],
      eventId: ["events", "name"],
      carListingId: ["car_listings", "title"],
    };
    return this.db.transaction(async (m) => {
      const trip = await this.access(m, user, id, true);
      if (trip.cancelled_at)
        throw new BadRequestException("This trip is cancelled");
      if (input.day > trip.duration_days)
        throw new BadRequestException("Choose a day within this trip");
      const [item] = await m.query(
        `SELECT ${tables[key][1]} AS title FROM ${tables[key][0]} WHERE id=$1`,
        [input[key]],
      );
      if (!item) throw new NotFoundException("Item not found");
      const [count] = await m.query(
        "SELECT count(*)::int AS n FROM trip_suggestions WHERE trip_id=$1",
        [id],
      );
      if (count.n >= 100)
        throw new BadRequestException("Remove a suggestion before adding more");
      const clean = { [key]: input[key], day: input.day };
      const inserted = await m.query(
        `INSERT INTO trip_suggestions(trip_id,user_id,title,input) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(trip_id,input) DO NOTHING RETURNING id`,
        [id, user, item.title, JSON.stringify(clean)],
      );
      if (inserted.length)
        await recordTripActivity(
          m,
          id,
          user,
          "suggested",
          item.title,
          `trip-suggestion-${inserted[0].id}`,
        );
      return { ok: true };
    });
  }
  async vote(user: string, id: string, suggestion: string, voted: boolean) {
    return this.db.transaction(async (m) => {
      const trip = await this.access(m, user, id, true);
      if (trip.cancelled_at)
        throw new BadRequestException("This trip is cancelled");
      const rows = await m.query(
        "SELECT id FROM trip_suggestions WHERE id=$1 AND trip_id=$2",
        [suggestion, id],
      );
      if (!rows.length) throw new NotFoundException("Suggestion not found");
      if (voted)
        await m.query(
          "INSERT INTO trip_suggestion_votes(suggestion_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
          [suggestion, user],
        );
      else
        await m.query(
          "DELETE FROM trip_suggestion_votes WHERE suggestion_id=$1 AND user_id=$2",
          [suggestion, user],
        );
      return { ok: true };
    });
  }
  async remove(user: string, id: string, suggestion: string) {
    return this.db.transaction(async (m) => {
      const trip = await this.access(m, user, id, true);
      const [row] = await m.query(
        "SELECT user_id FROM trip_suggestions WHERE id=$1 AND trip_id=$2",
        [suggestion, id],
      );
      if (!row) throw new NotFoundException("Suggestion not found");
      if (user !== trip.user_id && user !== row.user_id)
        throw new ForbiddenException(
          "Only the author or trip owner can remove a suggestion",
        );
      await m.query("DELETE FROM trip_suggestions WHERE id=$1", [suggestion]);
      return { ok: true };
    });
  }
  async choose(user: string, id: string, suggestion: string) {
    const trip = await this.access(this.db.manager, user, id);
    if (trip.cancelled_at)
      throw new BadRequestException("This trip is cancelled");
    if (trip.user_id !== user)
      throw new ForbiddenException(
        "Only the trip owner can add a voted suggestion",
      );
    const [row] = await this.db.query(
      "SELECT input FROM trip_suggestions WHERE id=$1 AND trip_id=$2",
      [suggestion, id],
    );
    if (!row) throw new NotFoundException("Suggestion not found");
    return this.trips.addStop(user, id, row.input);
  }
}
