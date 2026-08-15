import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Itinerary, ItineraryStop } from "./entities/itinerary.entity";
import { Place } from "../places/entities/place.entity";
import { PlaceType } from "../places/entities/place.enums";
import { BudgetBand, ItineraryKind } from "./entities/itinerary.enums";
import { GenerateTripDto } from "./dto/generate-trip.dto";
import { GenerateWeekendDto } from "./dto/generate-weekend.dto";

// Home screen "Explore the map" default center — used as the implicit
// starting point for "Build My Liberia Trip" when no location is given
// (Weekend Explorer always requires an explicit starting point).
const MONROVIA_CENTER = { lat: 6.3106, lng: -10.8047 };

const STOPS_PER_DAY = 2;
// Matches web/src/lib/format.ts's estimateTravelTime assumption, so the
// same "~35 km/h" mental model holds on both sides of the API.
const ASSUMED_KMH = 35;

// The itinerary is a sequence of things-to-do stops, not a full logistics
// plan — hotels/restaurants are deliberately left out of the generated
// route. Each stop's own Destination Profile already surfaces "Nearby"
// accommodation and dining, so the itinerary doesn't need to solve that too.
const STOP_TYPES = [
  PlaceType.ATTRACTION,
  PlaceType.NATURE_SITE,
  PlaceType.ACTIVITY_PROVIDER,
];

export interface ItineraryStopWithPlace extends Omit<ItineraryStop, "placeId"> {
  place: Place;
}

export interface ItineraryResponse extends Omit<Itinerary, "stops"> {
  stops: ItineraryStopWithPlace[];
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function budgetThreshold(band: BudgetBand): number | null {
  switch (band) {
    case BudgetBand.BUDGET:
      return 10;
    case BudgetBand.MODERATE:
      return 50;
    case BudgetBand.PREMIUM:
    default:
      return null; // no cap
  }
}

@Injectable()
export class ItinerariesService {
  constructor(
    @InjectRepository(Itinerary)
    private readonly itineraryRepo: Repository<Itinerary>,
    @InjectRepository(Place)
    private readonly placeRepo: Repository<Place>,
  ) {}

  async generateTrip(
    userId: string,
    dto: GenerateTripDto,
  ): Promise<ItineraryResponse> {
    const candidates = await this.findCandidates(dto.interests, dto.budgetBand);
    const ordered = this.sequenceByProximity(
      candidates,
      MONROVIA_CENTER,
      dto.durationDays * STOPS_PER_DAY,
    );
    const stops = this.assignDays(ordered, dto.durationDays);

    const itinerary = await this.itineraryRepo.save(
      this.itineraryRepo.create({
        userId,
        title: dto.title ?? `${dto.durationDays}-Day Liberia Trip`,
        kind: ItineraryKind.TRIP,
        durationDays: dto.durationDays,
        budgetBand: dto.budgetBand,
        interests: dto.interests,
        stops: stops.map(({ place, ...rest }) => ({
          ...rest,
          placeId: place.id,
        })),
      }),
    );

    return this.toResponse(itinerary, ordered);
  }

  async generateWeekend(
    userId: string,
    dto: GenerateWeekendDto,
  ): Promise<ItineraryResponse> {
    const maxDistanceKm = (dto.maxTravelTimeMinutes / 60) * ASSUMED_KMH;
    const start = { lat: dto.startLat, lng: dto.startLng };

    const allCandidates = await this.findCandidates(
      dto.interests,
      dto.budgetBand,
    );
    const reachable = allCandidates.filter(
      (p) =>
        haversineKm(start.lat, start.lng, p.latitude, p.longitude) <=
        maxDistanceKm,
    );
    if (reachable.length === 0) {
      throw new NotFoundException(
        "No places match your interests and budget within that travel time — try a wider radius or different interests.",
      );
    }

    const durationDays = dto.durationDays ?? 1;
    const ordered = this.sequenceByProximity(
      reachable,
      start,
      durationDays * STOPS_PER_DAY,
    );
    const stops = this.assignDays(ordered, durationDays);

    const itinerary = await this.itineraryRepo.save(
      this.itineraryRepo.create({
        userId,
        title: "Weekend Explorer Trip",
        kind: ItineraryKind.WEEKEND,
        durationDays,
        budgetBand: dto.budgetBand,
        interests: dto.interests,
        stops: stops.map(({ place, ...rest }) => ({
          ...rest,
          placeId: place.id,
        })),
      }),
    );

    return this.toResponse(itinerary, ordered);
  }

  async findMine(userId: string): Promise<Itinerary[]> {
    return this.itineraryRepo.find({
      where: { userId },
      order: { createdAt: "DESC" },
    });
  }

  async findOne(userId: string, id: string): Promise<ItineraryResponse> {
    const itinerary = await this.itineraryRepo.findOne({
      where: { id, userId },
    });
    if (!itinerary) {
      throw new NotFoundException(`Itinerary "${id}" not found`);
    }
    const placeIds = itinerary.stops.map((s) => s.placeId);
    const places = placeIds.length
      ? await this.placeRepo.find({
          where: placeIds.map((id) => ({ id })),
          relations: ["category", "county"],
        })
      : [];
    return this.toResponse(itinerary, places);
  }

  private async findCandidates(
    interestSlugs: string[],
    budgetBand: BudgetBand,
  ): Promise<Place[]> {
    const qb = this.placeRepo
      .createQueryBuilder("place")
      .leftJoinAndSelect("place.category", "category")
      .leftJoinAndSelect("place.county", "county")
      .where("place.type IN (:...types)", { types: STOP_TYPES });

    if (interestSlugs.length > 0) {
      qb.andWhere("category.slug IN (:...interests)", {
        interests: interestSlugs,
      });
    }

    const threshold = budgetThreshold(budgetBand);
    if (threshold !== null) {
      qb.andWhere(
        "(place.estimatedCostEntry IS NULL OR place.estimatedCostEntry <= :threshold)",
        { threshold },
      );
    }

    const candidates = await qb.getMany();
    if (candidates.length === 0) {
      throw new BadRequestException(
        "No places match your selected interests and budget — try broadening your selection.",
      );
    }
    return candidates;
  }

  /** Greedy nearest-neighbor: not optimal TSP, but a good-enough route for a
   * handful of stops, and cheap enough to run per-request with no extra
   * infrastructure. */
  private sequenceByProximity(
    candidates: Place[],
    from: { lat: number; lng: number },
    maxStops: number,
  ): Place[] {
    const remaining = [...candidates];
    const ordered: Place[] = [];
    let current = from;

    while (ordered.length < maxStops && remaining.length > 0) {
      remaining.sort(
        (a, b) =>
          haversineKm(current.lat, current.lng, a.latitude, a.longitude) -
          haversineKm(current.lat, current.lng, b.latitude, b.longitude),
      );
      const next = remaining.shift()!;
      ordered.push(next);
      current = { lat: next.latitude, lng: next.longitude };
    }
    return ordered;
  }

  private assignDays(
    ordered: Place[],
    durationDays: number,
  ): { day: number; order: number; place: Place; notes: null }[] {
    const stopsPerDay = Math.max(1, Math.ceil(ordered.length / durationDays));
    return ordered.map((place, i) => ({
      day: Math.floor(i / stopsPerDay) + 1,
      order: i % stopsPerDay,
      place,
      notes: null,
    }));
  }

  private toResponse(
    itinerary: Itinerary,
    resolvedPlaces: Place[],
  ): ItineraryResponse {
    const placeById = new Map(resolvedPlaces.map((p) => [p.id, p]));
    return {
      ...itinerary,
      stops: itinerary.stops
        .map((s) => ({
          day: s.day,
          order: s.order,
          notes: s.notes,
          place: placeById.get(s.placeId),
        }))
        .filter((s): s is ItineraryStopWithPlace => !!s.place),
    };
  }
}
