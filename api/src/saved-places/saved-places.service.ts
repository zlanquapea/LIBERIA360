import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { Place } from "../places/entities/place.entity";
import { SavedPlace } from "./entities/saved-place.entity";

@Injectable()
export class SavedPlacesService {
  constructor(
    @InjectRepository(SavedPlace)
    private readonly savedPlaceRepo: Repository<SavedPlace>,
    @InjectRepository(Place)
    private readonly placeRepo: Repository<Place>,
  ) {}

  /** GET /saved-places — the account's saved list, as slugs (same shape
   * `useSavedPlaces` already keeps in localStorage), newest first. */
  async listSlugsForUser(userId: string): Promise<string[]> {
    const rows = await this.savedPlaceRepo.find({
      where: { userId },
      relations: { place: true },
      order: { createdAt: "DESC" },
    });
    // A place can be hard-deleted out from under a saved row (cascades the
    // FK, so this filter is just defensive — relations: {place: true}
    // can still come back null mid-transaction on some drivers).
    return rows.filter((row) => row.place).map((row) => row.place.slug);
  }

  /** POST /saved-places/:placeId — idempotent via `.upsert()` on the
   * (userId, placeId) unique constraint, so a double-click or a retried
   * request can never error or duplicate a row. */
  async savePlace(userId: string, placeId: string): Promise<void> {
    const place = await this.placeRepo.findOne({ where: { id: placeId } });
    if (!place) throw new NotFoundException("Place not found");
    await this.savedPlaceRepo.upsert({ userId, placeId }, [
      "userId",
      "placeId",
    ]);
  }

  /** DELETE /saved-places/:placeId — same idempotent contract as unsaving
   * something never saved in the first place: a no-op, not an error. */
  async unsavePlace(userId: string, placeId: string): Promise<void> {
    await this.savedPlaceRepo.delete({ userId, placeId });
  }

  /** POST /saved-places/sync — folds a device's local (pre-login) saved
   * slugs into the account's saved places, once per login (see
   * useSavedPlaces' merge-on-login effect), and hands back the full
   * merged, de-duplicated slug list so the device's local cache can be
   * overwritten with the authoritative account copy. An unknown slug
   * (stale/removed place) is silently dropped rather than failing the
   * whole merge — same tolerance as TripInvitation/TicketTransfer's
   * "never let account-adjacent bookkeeping fail the flow that touched
   * it" pattern elsewhere in this codebase. */
  async syncFromDevice(
    userId: string,
    localSlugs: string[],
  ): Promise<string[]> {
    if (localSlugs.length > 0) {
      const places = await this.placeRepo.find({
        where: { slug: In(localSlugs) },
      });
      if (places.length > 0) {
        await this.savedPlaceRepo.upsert(
          places.map((place) => ({ userId, placeId: place.id })),
          ["userId", "placeId"],
        );
      }
    }
    return this.listSlugsForUser(userId);
  }
}
