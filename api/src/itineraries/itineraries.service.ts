import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Itinerary, ItineraryStop } from "./entities/itinerary.entity";
import { ItineraryCollaborator } from "./entities/itinerary-collaborator.entity";
import { Place } from "../places/entities/place.entity";
import { PlaceType } from "../places/entities/place.enums";
import { BudgetBand, ItineraryKind } from "./entities/itinerary.enums";
import { GenerateTripDto } from "./dto/generate-trip.dto";
import { GenerateWeekendDto } from "./dto/generate-weekend.dto";
import { AddStopDto } from "./dto/add-stop.dto";
import { UpdateStopDto } from "./dto/update-stop.dto";
import { UsersService } from "../users/users.service";
import { PublicUser, toPublicUser } from "../users/user.serializer";

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
  collaborators: PublicUser[];
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
    @InjectRepository(ItineraryCollaborator)
    private readonly collaboratorRepo: Repository<ItineraryCollaborator>,
    private readonly usersService: UsersService,
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

    return this.toResponse(itinerary, ordered, []);
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

    return this.toResponse(itinerary, ordered, []);
  }

  async findMine(userId: string): Promise<Itinerary[]> {
    return this.itineraryRepo.find({
      where: { userId },
      order: { createdAt: "DESC" },
    });
  }

  /** Trips someone else owns but has added this user to as a collaborator
   * — the other half of "My Trips" (Wanderlog/TripIt-style collaborative
   * planning), kept as a separate endpoint rather than folded into
   * findMine so existing callers of GET /itineraries don't change shape. */
  async findSharedWithMe(userId: string): Promise<Itinerary[]> {
    const memberships = await this.collaboratorRepo.find({
      where: { userId },
      relations: ["itinerary"],
      order: { createdAt: "DESC" },
    });
    return memberships.map((m) => m.itinerary);
  }

  async findOne(userId: string, id: string): Promise<ItineraryResponse> {
    const itinerary = await this.itineraryRepo.findOne({ where: { id } });
    if (!itinerary) {
      throw new NotFoundException(`Itinerary "${id}" not found`);
    }
    const collaborators = await this.assertCanView(userId, itinerary);
    const placeIds = itinerary.stops.map((s) => s.placeId);
    const places = placeIds.length
      ? await this.placeRepo.find({
          where: placeIds.map((id) => ({ id })),
          relations: ["category", "county"],
        })
      : [];
    return this.toResponse(itinerary, places, collaborators);
  }

  /** Invite another user (by email) to co-plan this trip — owner only, so
   * a collaborator can't unilaterally invite further collaborators onto
   * someone else's trip. */
  async inviteCollaborator(
    ownerId: string,
    itineraryId: string,
    email: string,
  ): Promise<PublicUser[]> {
    const itinerary = await this.getOwned(ownerId, itineraryId);
    const invitee = await this.usersService.findByEmail(email);
    if (!invitee) {
      throw new NotFoundException(`No account found for "${email}"`);
    }
    if (invitee.id === ownerId) {
      throw new BadRequestException("You already own this trip");
    }
    const existing = await this.collaboratorRepo.findOne({
      where: { itineraryId: itinerary.id, userId: invitee.id },
    });
    if (existing) {
      throw new ConflictException(
        `${invitee.name} is already a collaborator on this trip`,
      );
    }
    await this.collaboratorRepo.save(
      this.collaboratorRepo.create({
        itineraryId: itinerary.id,
        userId: invitee.id,
        invitedByUserId: ownerId,
      }),
    );
    return this.listCollaborators(itinerary.id);
  }

  /** Owner can remove anyone; a collaborator can remove themself ("leave
   * this trip") — same self-service-cancel pattern BookingsService uses
   * for a guest cancelling their own booking. */
  async removeCollaborator(
    userId: string,
    itineraryId: string,
    collaboratorUserId: string,
  ): Promise<PublicUser[]> {
    const itinerary = await this.itineraryRepo.findOne({
      where: { id: itineraryId },
    });
    if (!itinerary) {
      throw new NotFoundException(`Itinerary "${itineraryId}" not found`);
    }
    // Membership check first (404s for a total stranger) before deciding
    // *what* they're allowed to do — same "don't confirm the id exists to
    // someone with no access at all" reasoning as getOwned.
    await this.assertCanView(userId, itinerary);
    const isOwner = itinerary.userId === userId;
    const isSelfRemoval = collaboratorUserId === userId;
    if (!isOwner && !isSelfRemoval) {
      throw new ForbiddenException(
        "Only the trip owner can remove other collaborators",
      );
    }
    await this.collaboratorRepo.delete({
      itineraryId,
      userId: collaboratorUserId,
    });
    return this.listCollaborators(itineraryId);
  }

  /** Add a stop — owner or any collaborator. */
  async addStop(
    userId: string,
    itineraryId: string,
    dto: AddStopDto,
  ): Promise<ItineraryResponse> {
    const itinerary = await this.getEditable(userId, itineraryId);
    const place = await this.placeRepo.findOne({ where: { id: dto.placeId } });
    if (!place) {
      throw new NotFoundException(`Place "${dto.placeId}" not found`);
    }
    if (itinerary.stops.some((s) => s.placeId === dto.placeId)) {
      throw new ConflictException("This place is already on the trip");
    }
    const stopsForDay = itinerary.stops.filter((s) => s.day === dto.day);
    const order = stopsForDay.length
      ? Math.max(...stopsForDay.map((s) => s.order)) + 1
      : 0;
    itinerary.stops = [
      ...itinerary.stops,
      { day: dto.day, order, placeId: dto.placeId, notes: dto.notes ?? null },
    ];
    itinerary.durationDays = Math.max(itinerary.durationDays, dto.day);
    const saved = await this.itineraryRepo.save(itinerary);
    return this.findOne(userId, saved.id);
  }

  /** Remove a stop — owner or any collaborator. */
  async removeStop(
    userId: string,
    itineraryId: string,
    placeId: string,
  ): Promise<ItineraryResponse> {
    const itinerary = await this.getEditable(userId, itineraryId);
    itinerary.stops = itinerary.stops.filter((s) => s.placeId !== placeId);
    await this.itineraryRepo.save(itinerary);
    return this.findOne(userId, itineraryId);
  }

  /** Edit a stop's notes — the shared "who's bringing what / meet here at
   * 9am" annotation collaborators leave for each other. */
  async updateStop(
    userId: string,
    itineraryId: string,
    placeId: string,
    dto: UpdateStopDto,
  ): Promise<ItineraryResponse> {
    const itinerary = await this.getEditable(userId, itineraryId);
    const stop = itinerary.stops.find((s) => s.placeId === placeId);
    if (!stop) {
      throw new NotFoundException(`Stop for place "${placeId}" not found`);
    }
    stop.notes = dto.notes ?? null;
    itinerary.stops = [...itinerary.stops];
    await this.itineraryRepo.save(itinerary);
    return this.findOne(userId, itineraryId);
  }

  private async listCollaborators(itineraryId: string): Promise<PublicUser[]> {
    const rows = await this.collaboratorRepo.find({
      where: { itineraryId },
      order: { createdAt: "ASC" },
    });
    return rows.map((r) => toPublicUser(r.user));
  }

  private async getOwned(
    userId: string,
    itineraryId: string,
  ): Promise<Itinerary> {
    const itinerary = await this.itineraryRepo.findOne({
      where: { id: itineraryId },
    });
    if (!itinerary) {
      throw new NotFoundException(`Itinerary "${itineraryId}" not found`);
    }
    if (itinerary.userId === userId) {
      return itinerary;
    }
    // A collaborator can see this trip but can't invite onto someone
    // else's — a stranger with no access at all still just gets 404, to
    // avoid confirming a random itinerary id exists.
    await this.assertCanView(userId, itinerary);
    throw new ForbiddenException("Only the trip owner can do this");
  }

  /** Owner or collaborator — read access. Returns the collaborator list
   * (the trip detail view shows it either way) so callers that already
   * need it don't have to look it up twice. */
  private async assertCanView(
    userId: string,
    itinerary: Itinerary,
  ): Promise<PublicUser[]> {
    const collaborators = await this.listCollaborators(itinerary.id);
    const isMember =
      itinerary.userId === userId || collaborators.some((c) => c.id === userId);
    if (!isMember) {
      throw new NotFoundException(`Itinerary "${itinerary.id}" not found`);
    }
    return collaborators;
  }

  /** Owner or collaborator — write access to the stop list. Same
   * membership check as assertCanView; kept separate since a future
   * read-only viewer tier would only need to change this one. */
  private async getEditable(
    userId: string,
    itineraryId: string,
  ): Promise<Itinerary> {
    const itinerary = await this.itineraryRepo.findOne({
      where: { id: itineraryId },
    });
    if (!itinerary) {
      throw new NotFoundException(`Itinerary "${itineraryId}" not found`);
    }
    await this.assertCanView(userId, itinerary);
    return itinerary;
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
    collaborators: PublicUser[],
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
      collaborators,
    };
  }
}
