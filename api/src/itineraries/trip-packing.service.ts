import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { SaveTripPackingDto } from "./trip-packing.dto";

@Injectable()
export class TripPackingService {
  constructor(private readonly db: DataSource) {}
  private async access(
    manager: EntityManager,
    userId: string,
    tripId: string,
    lock = false,
  ) {
    const trips = await manager.query(
      `SELECT user_id FROM itineraries WHERE id = $1${lock ? " FOR UPDATE" : ""}`,
      [tripId],
    );
    if (!trips.length) throw new NotFoundException("Trip not found");
    if (trips[0].user_id === userId) return;
    const members = await manager.query(
      "SELECT 1 FROM itinerary_collaborators WHERE itinerary_id = $1 AND user_id = $2",
      [tripId, userId],
    );
    if (!members.length) throw new NotFoundException("Trip not found");
    // View-only members may maintain their own personal checklist.
  }
  async get(userId: string, tripId: string) {
    await this.access(this.db.manager, userId, tripId);
    const rows = await this.db.query(
      "SELECT items, version FROM trip_packing_lists WHERE trip_id = $1 AND user_id = $2",
      [tripId, userId],
    );
    return rows[0] ?? { items: [], version: 0 };
  }
  async save(userId: string, tripId: string, dto: SaveTripPackingDto) {
    const items = dto.items.map((item) => ({
      ...item,
      name: item.name.trim(),
    }));
    if (
      items.some((item) => !item.name) ||
      new Set(items.map((item) => item.id)).size !== items.length
    )
      throw new BadRequestException("Every item needs a name and a unique ID.");
    if (
      new Set(items.map((item) => item.name.toLowerCase())).size !==
      items.length
    )
      throw new BadRequestException(
        "This item is already on your list. Update its quantity instead.",
      );
    return this.db.transaction(async (manager) => {
      await this.access(manager, userId, tripId, true);
      const rows = await manager.query(
        "SELECT version FROM trip_packing_lists WHERE trip_id = $1 AND user_id = $2",
        [tripId, userId],
      );
      if ((rows[0]?.version ?? 0) !== dto.version)
        throw new ConflictException(
          "Your checklist changed on another device. Reload it before saving again.",
        );
      const version = dto.version + 1;
      await manager.query(
        `INSERT INTO trip_packing_lists (trip_id, user_id, items, version) VALUES ($1, $2, $3::jsonb, $4) ON CONFLICT (trip_id, user_id) DO UPDATE SET items = EXCLUDED.items, version = EXCLUDED.version, updated_at = NOW()`,
        [tripId, userId, JSON.stringify(items), version],
      );
      return { items, version };
    });
  }
}
