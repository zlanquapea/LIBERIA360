import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Itinerary, ItineraryStop } from "./entities/itinerary.entity";
import { ItineraryCollaborator } from "./entities/itinerary-collaborator.entity";
import {
  TripInvitation,
  TripInvitationStatus,
  invitationExpiresAt,
} from "./entities/trip-invitation.entity";
import {
  TripJoinRequest,
  TripJoinRequestStatus,
} from "./entities/trip-join-request.entity";
import { Place } from "../places/entities/place.entity";
import { PlaceType } from "../places/entities/place.enums";
import {
  BudgetBand,
  ItineraryKind,
  TripStatus,
  TripVisibility,
} from "./entities/itinerary.enums";
import { GenerateTripDto } from "./dto/generate-trip.dto";
import { CreateTripDto } from "./dto/create-trip.dto";
import { GenerateWeekendDto } from "./dto/generate-weekend.dto";
import { QueryPublicTripsDto } from "./dto/query-public-trips.dto";
import { AddStopDto } from "./dto/add-stop.dto";
import { UpdateStopDto } from "./dto/update-stop.dto";
import { InviteeDto } from "./dto/create-invitations.dto";
import { UsersService } from "../users/users.service";
import {
  InvitableUser,
  PublicUser,
  toInvitableUser,
  toPublicUser,
} from "../users/user.serializer";
import { User } from "../users/entities/user.entity";
import { MailService } from "../mail/mail.service";
import { NotificationsService } from "../notifications/notifications.service";
import { TripChatService } from "../trip-chat/trip-chat.service";
import { AppConfig } from "../config/configuration";
import { generateToken, hashToken, hashesMatch } from "../auth/token-hash";

const STOPS_PER_DAY = 2;
// Matches web/src/lib/format.ts's estimateTravelTime assumption, so the
// same "~35 km/h" mental model holds on both sides of the API.
const ASSUMED_KMH = 35;

// Was previously enforced as a @Min(1)/@Max(14) bound on a client-supplied
// durationDays field; now that a trip is framed by real dates (see
// resolveDurationDays), it's the bound on the date range itself instead.
const MAX_TRIP_DURATION_DAYS = 14;

// The itinerary is a sequence of things-to-do stops, not a full logistics
// plan — hotels/restaurants are deliberately left out of the generated
// route. Each stop's own Destination Profile already surfaces "Nearby"
// accommodation and dining, so the itinerary doesn't need to solve that too.
const STOP_TYPES = [
  PlaceType.ATTRACTION,
  PlaceType.NATURE_SITE,
  PlaceType.ACTIVITY_PROVIDER,
];

export type InvitationDisplayStatus =
  "pending" | "viewed" | "accepted" | "declined" | "expired";

export interface InvitationSummary {
  id: string;
  email: string;
  status: InvitationDisplayStatus;
  invitee: PublicUser | null;
  emailDelivered: boolean;
  createdAt: Date;
  respondedAt: Date | null;
  expiresAt: Date;
}

export interface MyInvitationSummary {
  id: string;
  tripId: string;
  tripTitle: string;
  destinationSummary: string;
  durationDays: number;
  organizerName: string;
  createdAt: Date;
  expiresAt: Date;
}

/** GET /invitations/token/:token — the pre-authentication preview
 * (Section 2/9). Deliberately thin: no stop list, no other participants'
 * contact info, nothing that would leak real trip content to whoever
 * happens to have (or guess at) a link before they've proven they're the
 * invitee. */
export interface InvitationPreview {
  tripTitle: string;
  tripKind: ItineraryKind;
  durationDays: number;
  destinationSummary: string;
  overview: string;
  organizerName: string;
  invitedEmail: string;
  otherParticipantNames: string[];
  status: InvitationDisplayStatus;
  // No account is linked to this invite yet — the frontend uses this to
  // decide whether to show "Create account & join" vs "Log in to accept".
  requiresAccount: boolean;
}

export interface ItineraryStopWithPlace extends Omit<ItineraryStop, "placeId"> {
  place: Place;
}

export interface ItineraryResponse extends Omit<Itinerary, "stops"> {
  stops: ItineraryStopWithPlace[];
  collaborators: PublicUser[];
  // The creator, always the trip's "Trip Admin" — resolved here so the
  // frontend can label them without a second lookup (Section 7 of the
  // Aug 2026 social-trip spec: "The admin status should be clearly
  // indicated next to the creator's profile").
  admin: PublicUser | null;
  status: TripStatus;
}

/** GET /itineraries/public and GET /itineraries/public/:id — what a
 * stranger (signed in or not) gets to see about a PUBLIC trip: enough to
 * decide whether to request to join, never the full collaborator list
 * (Section 8: "Users must be signed into LIBERIA360 to view the full
 * participant list" — and even signed in, only a participant/admin gets
 * that, via the authenticated GET /itineraries/:id instead). */
export interface PublicTripSummary {
  id: string;
  title: string;
  destination: Place | null;
  description: string | null;
  coverImage: string | null;
  startDate: Date | null;
  endDate: Date | null;
  status: TripStatus;
  admin: PublicUser | null;
  participantCount: number;
  createdAt: Date;
}

export interface PublicTripDetail extends PublicTripSummary {
  stops: ItineraryStopWithPlace[];
}

/** What GET /itineraries/public/:id returns for a PRIVATE trip instead of
 * a 404 — a deliberate, spec-driven exception to this codebase's usual
 * "don't confirm a random id exists to someone with no access" rule (see
 * getOwned's own comment on that rule): Section 15 explicitly wants
 * someone who follows a real private-trip link to see "This is a private
 * trip. You must be invited..." rather than an ambiguous not-found page,
 * which only makes sense if this path *does* confirm the trip exists. A
 * genuinely nonexistent id still 404s (see findPublicTripById) — this is
 * only reachable for a real trip that happens to be private. */
export interface RestrictedTripPreview {
  id: string;
  visibility: TripVisibility.PRIVATE;
}

export interface TripJoinRequestSummary {
  id: string;
  user: PublicUser;
  status: TripJoinRequestStatus;
  createdAt: Date;
  respondedAt: Date | null;
}

// Product review readout (Aug 22, 2026), "guest-first trip planning": a
// not-yet-saved trip shell, returned by previewTrip. Deliberately not an
// ItineraryResponse — there's no id, userId, or createdAt because nothing
// was persisted. Saving is just calling generateTrip afterward with the
// same inputs, rather than a second endpoint that has to trust
// client-supplied stop data back into the DB. `stops` is always empty
// (see generateTrip's doc comment) — kept on the shape so this stays
// structurally interchangeable with ItineraryResponse for anything that
// renders either one (ItineraryStops, the day list, …).
export interface TripPreviewResponse {
  title: string;
  kind: ItineraryKind;
  durationDays: number;
  budgetBand: BudgetBand;
  interests: string[];
  startDate: string;
  endDate: string;
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

// Shared by generateTrip/previewTrip: a trip is framed by a real start and
// end date rather than a bare day count (Sept 2026 product note — "add a
// start date and end date," "the user should have control"), so the
// day-count the rest of this service still stores (durationDays, used by
// the day picker on AddTripStop and the "X days" summary line) is derived
// from that range instead of trusted as a separate client input that could
// silently drift out of sync with it.
function resolveDurationDays(dto: {
  startDate: string;
  endDate: string;
}): number {
  const start = new Date(dto.startDate);
  const end = new Date(dto.endDate);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (days < 1) {
    throw new BadRequestException(
      "The end date can't be before the start date.",
    );
  }
  if (days > MAX_TRIP_DURATION_DAYS) {
    throw new BadRequestException(
      `Trips can be at most ${MAX_TRIP_DURATION_DAYS} days — pick a shorter date range.`,
    );
  }
  return days;
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
    @InjectRepository(TripInvitation)
    private readonly invitationRepo: Repository<TripInvitation>,
    @InjectRepository(TripJoinRequest)
    private readonly joinRequestRepo: Repository<TripJoinRequest>,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
    private readonly tripChatService: TripChatService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  /** "Plan a Trip" (redesigned per the Sept 2026 product note — "the user
   * should have control," "a person can plan a 3-day trip at a single
   * location"). No route is auto-generated here: earlier versions filled
   * every day with catalog places picked by interest/budget and proximity
   * alone, which routinely scattered stops across the whole country with
   * no regard for the destination the traveler actually searched for or
   * whether they wanted one place for the whole trip. The trip is created
   * with its date range and nothing else — the traveler adds their own
   * stops afterward from the trip page (AddTripStop), to whichever day(s)
   * they choose, as few or as many as the trip actually needs. */
  async generateTrip(
    userId: string,
    dto: CreateTripDto,
  ): Promise<ItineraryResponse> {
    const destination = await this.placeRepo.findOne({
      where: { id: dto.destinationPlaceId },
    });
    if (!destination) {
      throw new NotFoundException(
        `Place "${dto.destinationPlaceId}" not found`,
      );
    }
    const durationDays = resolveDurationDays(dto);

    const itinerary = await this.itineraryRepo.save(
      this.itineraryRepo.create({
        userId,
        title: dto.title,
        kind: ItineraryKind.TRIP,
        durationDays,
        budgetBand: dto.budgetBand,
        interests: dto.interests,
        destinationPlaceId: dto.destinationPlaceId,
        visibility: dto.visibility,
        description: dto.description ?? null,
        coverImage: dto.coverImage ?? null,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        stops: [],
      }),
    );
    itinerary.destination = destination;

    return this.toResponse(itinerary, [], []);
  }

  /** Same as generateTrip minus the save — lets a visitor with no account
   * see exactly what they're about to create (name, dates, destination)
   * before deciding whether it's worth logging in to keep it. */
  async previewTrip(dto: GenerateTripDto): Promise<TripPreviewResponse> {
    const durationDays = resolveDurationDays(dto);

    return {
      title: dto.title ?? `${durationDays}-Day Liberia Trip`,
      kind: ItineraryKind.TRIP,
      durationDays,
      budgetBand: dto.budgetBand,
      interests: dto.interests,
      startDate: dto.startDate,
      endDate: dto.endDate,
      stops: [],
    };
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

  /** Rename a trip — owner or any collaborator, same tier as editing a
   * stop's notes: this is shared planning metadata, not an
   * ownership-only action. Generated trips default to a generic title
   * ("5-Day Liberia Trip", "Weekend Explorer Trip"); this is the only way
   * to turn that into "Mom's 60th birthday trip" or whatever it actually
   * is for the people planning it. */
  async renameTrip(
    userId: string,
    itineraryId: string,
    title: string,
  ): Promise<ItineraryResponse> {
    const itinerary = await this.getEditable(userId, itineraryId);
    const previousTitle = itinerary.title;
    itinerary.title = title;
    await this.itineraryRepo.save(itinerary);
    if (previousTitle !== title) {
      const renamer = await this.usersService.findById(userId);
      await this.tripChatService.postSystemMessage(
        itineraryId,
        `${renamer?.name ?? "Someone"} renamed the trip to "${title}".`,
      );
    }
    return this.findOne(userId, itineraryId);
  }

  /** Owner-only, permanent. Collaborator rows and any open/resolved
   * invitations cascade away with it at the DB level (both FK to
   * itineraries with ON DELETE CASCADE — see ItineraryCollaborator and
   * TripInvitation) so this never leaves orphaned rows; a collaborator
   * who had view/edit access simply loses it, the same outcome as if the
   * owner had removed them individually. There's no separate "leave" path
   * for the owner the way collaborators get one — deleting the trip *is*
   * the owner's way out, and only they can take it (matches every other
   * owner-only action here: inviting, cancelling an invitation, ...). */
  async deleteTrip(userId: string, itineraryId: string): Promise<void> {
    await this.getOwned(userId, itineraryId);
    await this.itineraryRepo.delete({ id: itineraryId });
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
    const removedUser = await this.usersService.findById(collaboratorUserId);
    const removedName = removedUser?.name ?? "Someone";
    await this.tripChatService.postSystemMessage(
      itineraryId,
      isSelfRemoval
        ? `${removedName} left the trip.`
        : `${removedName} was removed from the trip.`,
    );
    return this.listCollaborators(itineraryId);
  }

  // ---------------------------------------------------------------------
  // Trip invitations (Section 1-9 of the collaboration spec). Everything
  // below is owner-only to create/manage — same restriction the old
  // immediate-add inviteCollaborator() had — but now goes through a real
  // pending → viewed → accepted/declined/expired lifecycle instead of
  // adding a collaborator on the spot, and works for people who don't
  // have an account yet. See TripInvitation's class doc for the data
  // model reasoning.
  // ---------------------------------------------------------------------

  /** "People you may want to invite" (Section 7) — platform users
   * matching the search that aren't already on this trip (as a
   * confirmed collaborator or a still-pending invite). Owner-only, same
   * as everything else here: a stranger shouldn't be able to enumerate
   * platform users through someone else's trip. */
  async searchInvitablePeople(
    ownerId: string,
    itineraryId: string,
    query: string,
  ): Promise<InvitableUser[]> {
    await this.getOwned(ownerId, itineraryId);
    const [matches, collaborators, pending] = await Promise.all([
      this.usersService.searchByNameOrEmail(query, ownerId),
      this.collaboratorRepo.find({
        where: { itineraryId },
        select: ["userId"],
      }),
      this.invitationRepo.find({
        where: { itineraryId, status: TripInvitationStatus.PENDING },
        select: ["inviteeUserId"],
      }),
    ]);
    const alreadyIn = new Set<string>(collaborators.map((c) => c.userId));
    pending.forEach((p) => p.inviteeUserId && alreadyIn.add(p.inviteeUserId));
    return matches.filter((u) => !alreadyIn.has(u.id)).map(toInvitableUser);
  }

  /** POST /itineraries/:id/invitations — one or many invitees in a
   * single call (Section 7's "allow multiple invitations in one flow"),
   * each either a platform user (userId, from the search picker) or a
   * bare email address for someone who isn't on the platform yet. */
  async createInvitations(
    ownerId: string,
    itineraryId: string,
    invitees: InviteeDto[],
  ): Promise<InvitationSummary[]> {
    const itinerary = await this.getOwned(ownerId, itineraryId);
    for (const invitee of invitees) {
      await this.createOrResendInvitation(ownerId, itinerary, invitee);
    }
    return this.listInvitations(ownerId, itineraryId);
  }

  private async createOrResendInvitation(
    ownerId: string,
    itinerary: Itinerary,
    invitee: InviteeDto,
  ): Promise<void> {
    if (!invitee.userId && !invitee.email) {
      throw new BadRequestException(
        "Each invitee needs either an existing user or an email address",
      );
    }

    let inviteeUser: User | null = null;
    let email: string;
    if (invitee.userId) {
      inviteeUser = await this.usersService.findById(invitee.userId);
      if (!inviteeUser) {
        throw new NotFoundException("That person's account could not be found");
      }
      email = inviteeUser.email;
    } else {
      email = invitee.email!.toLowerCase();
      inviteeUser = await this.usersService.findByEmail(email);
    }

    if (inviteeUser?.id === ownerId || email === itinerary.userId) {
      throw new BadRequestException("You already own this trip");
    }

    if (inviteeUser) {
      const existingCollaborator = await this.collaboratorRepo.findOne({
        where: { itineraryId: itinerary.id, userId: inviteeUser.id },
      });
      if (existingCollaborator) {
        throw new ConflictException(
          `${inviteeUser.name} is already part of this trip`,
        );
      }
    }

    let invitation = await this.invitationRepo.findOne({
      where: { itineraryId: itinerary.id, email },
    });
    if (invitation?.status === TripInvitationStatus.ACCEPTED) {
      throw new ConflictException(
        `${inviteeUser?.name ?? email} is already part of this trip`,
      );
    }

    const token = generateToken();
    if (invitation) {
      // Resend/re-invite: reuse the same row (declined or expired) rather
      // than accumulating duplicate history for the same email on this trip.
      invitation.tokenHash = hashToken(token);
      invitation.status = TripInvitationStatus.PENDING;
      invitation.viewedAt = null;
      invitation.respondedAt = null;
      invitation.expiresAt = invitationExpiresAt();
      invitation.inviteeUserId = inviteeUser?.id ?? null;
      invitation.invitedByUserId = ownerId;
    } else {
      invitation = this.invitationRepo.create({
        itineraryId: itinerary.id,
        invitedByUserId: ownerId,
        email,
        inviteeUserId: inviteeUser?.id ?? null,
        tokenHash: hashToken(token),
        expiresAt: invitationExpiresAt(),
      });
    }
    invitation = await this.invitationRepo.save(invitation);
    await this.sendInvitationEmail(itinerary, invitation, token, inviteeUser);
    if (inviteeUser) {
      const inviter = await this.usersService.findById(ownerId);
      await this.notificationsService.create(inviteeUser.id, {
        type: "trip.invitation_received",
        title: "You've been invited to a trip",
        body: `${inviter?.name ?? "Someone"} invited you to "${itinerary.title}".`,
        link: "/invitations",
      });
    }
  }

  /** The trip's People/Participants panel (Section 4/7) — owner-only. */
  async listInvitations(
    ownerId: string,
    itineraryId: string,
  ): Promise<InvitationSummary[]> {
    await this.getOwned(ownerId, itineraryId);
    const rows = await this.invitationRepo.find({
      where: { itineraryId },
      relations: ["invitee"],
      order: { createdAt: "DESC" },
    });
    return rows.map((r) => this.toInvitationSummary(r));
  }

  /** Owner resends a still-pending invite: fresh token, fresh 14-day
   * clock, re-sent email — the "Allow the organizer to resend pending
   * invitations" requirement (Section 4). */
  async resendInvitation(
    ownerId: string,
    itineraryId: string,
    invitationId: string,
  ): Promise<InvitationSummary[]> {
    const itinerary = await this.getOwned(ownerId, itineraryId);
    const invitation = await this.invitationRepo.findOne({
      where: { id: invitationId, itineraryId },
    });
    if (!invitation) {
      throw new NotFoundException("Invitation not found");
    }
    if (invitation.status !== TripInvitationStatus.PENDING) {
      throw new ConflictException("Only a pending invitation can be resent");
    }
    const token = generateToken();
    invitation.tokenHash = hashToken(token);
    invitation.expiresAt = invitationExpiresAt();
    invitation.viewedAt = null;
    await this.invitationRepo.save(invitation);
    const inviteeUser = invitation.inviteeUserId
      ? await this.usersService.findById(invitation.inviteeUserId)
      : null;
    await this.sendInvitationEmail(itinerary, invitation, token, inviteeUser);
    return this.listInvitations(ownerId, itineraryId);
  }

  /** Owner revokes an invitation outright (pending or already
   * declined/expired) — the link stops working immediately either way,
   * since the row it depends on is gone. */
  async cancelInvitation(
    ownerId: string,
    itineraryId: string,
    invitationId: string,
  ): Promise<InvitationSummary[]> {
    await this.getOwned(ownerId, itineraryId);
    await this.invitationRepo.delete({ id: invitationId, itineraryId });
    return this.listInvitations(ownerId, itineraryId);
  }

  /** GET /invitations/token/:token — public, unauthenticated. Marks the
   * invite "viewed" the first time it's opened while still pending. */
  async getInvitationPreview(token: string): Promise<InvitationPreview> {
    const invitation = await this.findInvitationByToken(token);
    const itinerary = await this.itineraryRepo.findOne({
      where: { id: invitation.itineraryId },
    });
    if (!itinerary) {
      throw new NotFoundException("This trip no longer exists");
    }

    if (
      invitation.status === TripInvitationStatus.PENDING &&
      !invitation.viewedAt &&
      invitation.expiresAt.getTime() >= Date.now()
    ) {
      invitation.viewedAt = new Date();
      await this.invitationRepo.save(invitation);
    }

    const [inviter, collaborators, destinationSummary] = await Promise.all([
      this.usersService.findById(invitation.invitedByUserId),
      this.listCollaborators(itinerary.id),
      this.destinationSummary(itinerary),
    ]);

    return {
      tripTitle: itinerary.title,
      tripKind: itinerary.kind,
      durationDays: itinerary.durationDays,
      destinationSummary,
      overview: this.tripOverview(itinerary, destinationSummary),
      organizerName: inviter?.name ?? "A LIBERIA360 traveler",
      invitedEmail: invitation.email,
      otherParticipantNames: collaborators.slice(0, 5).map((c) => c.name),
      status: this.computeStatus(invitation),
      requiresAccount: !invitation.inviteeUserId,
    };
  }

  /** POST /invitations/token/:token/accept — the emailed-link flow. */
  acceptByToken(userId: string, token: string): Promise<ItineraryResponse> {
    return this.findInvitationByToken(token).then((row) =>
      this.acceptInvitationRow(userId, row),
    );
  }

  /** POST /itineraries/invitations/:id/accept — the "My Invitations"
   * in-app flow, for an invite already linked to this account (no token
   * in hand needed — see TripInvitation's doc comment: the plaintext
   * token is never persisted, only its hash, so this is the only way to
   * accept/decline once the email itself is gone). */
  async acceptById(
    userId: string,
    invitationId: string,
  ): Promise<ItineraryResponse> {
    const row = await this.invitationRepo.findOne({
      where: { id: invitationId },
    });
    if (!row) {
      throw new NotFoundException("Invitation not found");
    }
    return this.acceptInvitationRow(userId, row);
  }

  declineByToken(userId: string, token: string): Promise<void> {
    return this.findInvitationByToken(token).then((row) =>
      this.declineInvitationRow(userId, row),
    );
  }

  async declineById(userId: string, invitationId: string): Promise<void> {
    const row = await this.invitationRepo.findOne({
      where: { id: invitationId },
    });
    if (!row) {
      throw new NotFoundException("Invitation not found");
    }
    return this.declineInvitationRow(userId, row);
  }

  /** The invited person's own inbox of open invitations (Section 5) —
   * only ever invitations explicitly addressed to *this* account
   * (inviteeUserId set either by the organizer picking them from search,
   * or by AuthService.register linking an email-only invite at signup —
   * never inferred from an ambient email match here, which is what keeps
   * a pending invitation from being hijackable by another account). */
  async listMyInvitations(userId: string): Promise<MyInvitationSummary[]> {
    const rows = await this.invitationRepo.find({
      where: { inviteeUserId: userId, status: TripInvitationStatus.PENDING },
      relations: ["itinerary", "invitedBy"],
      order: { createdAt: "DESC" },
    });
    const active = rows.filter((r) => r.expiresAt.getTime() >= Date.now());
    return Promise.all(
      active.map(async (r) => ({
        id: r.id,
        tripId: r.itineraryId,
        tripTitle: r.itinerary.title,
        destinationSummary: await this.destinationSummary(r.itinerary),
        durationDays: r.itinerary.durationDays,
        organizerName: r.invitedBy?.name ?? "A LIBERIA360 traveler",
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
      })),
    );
  }

  /** Links a still-open, email-only invitation to a brand-new account —
   * called from AuthService.register right after account creation, so
   * "click invite → create account → land back on the same invitation,
   * already recognized" (Section 3) doesn't need the person to search
   * for the trip again or ask the organizer to resend. Never throws:
   * registration must succeed whether or not the invite token is valid,
   * stale, or already claimed — this only ever silently no-ops instead.
   * The token itself (not the email address someone chooses to register
   * with) is what proves the link, and once inviteeUserId is set it's
   * final — a second registration attempt with the same token can't
   * hijack an invite that's already claimed by a different account. */
  async linkInvitationToNewAccount(
    token: string,
    newUserId: string,
  ): Promise<void> {
    let invitation: TripInvitation;
    try {
      invitation = await this.findInvitationByToken(token);
    } catch {
      return;
    }
    if (
      invitation.status !== TripInvitationStatus.PENDING ||
      invitation.expiresAt.getTime() < Date.now()
    ) {
      return;
    }
    if (invitation.inviteeUserId && invitation.inviteeUserId !== newUserId) {
      return;
    }
    invitation.inviteeUserId = newUserId;
    await this.invitationRepo.save(invitation);
  }

  private async acceptInvitationRow(
    userId: string,
    row: TripInvitation,
  ): Promise<ItineraryResponse> {
    this.assertRespondable(row);
    if (row.inviteeUserId && row.inviteeUserId !== userId) {
      throw new ForbiddenException(
        "This invitation belongs to a different account",
      );
    }
    const itinerary = await this.itineraryRepo.findOne({
      where: { id: row.itineraryId },
    });
    if (!itinerary) {
      throw new NotFoundException("This trip no longer exists");
    }
    if (itinerary.userId === userId) {
      throw new BadRequestException("You already own this trip");
    }

    row.status = TripInvitationStatus.ACCEPTED;
    row.respondedAt = new Date();
    row.inviteeUserId = row.inviteeUserId ?? userId;
    await this.invitationRepo.save(row);

    const existingCollaborator = await this.collaboratorRepo.findOne({
      where: { itineraryId: itinerary.id, userId },
    });
    if (!existingCollaborator) {
      await this.collaboratorRepo.save(
        this.collaboratorRepo.create({
          itineraryId: itinerary.id,
          userId,
          invitedByUserId: row.invitedByUserId,
        }),
      );
    }

    await this.notifyOrganizerOfAcceptance(itinerary, userId);
    return this.findOne(userId, itinerary.id);
  }

  private async declineInvitationRow(
    userId: string,
    row: TripInvitation,
  ): Promise<void> {
    this.assertRespondable(row);
    if (row.inviteeUserId && row.inviteeUserId !== userId) {
      throw new ForbiddenException(
        "This invitation belongs to a different account",
      );
    }
    row.status = TripInvitationStatus.DECLINED;
    row.respondedAt = new Date();
    row.inviteeUserId = row.inviteeUserId ?? userId;
    await this.invitationRepo.save(row);
  }

  private assertRespondable(row: TripInvitation): void {
    if (row.status !== TripInvitationStatus.PENDING) {
      throw new ConflictException(
        `This invitation has already been ${row.status}`,
      );
    }
    if (row.expiresAt.getTime() < Date.now()) {
      throw new ConflictException(
        "This invitation has expired — ask the organizer to resend it",
      );
    }
  }

  private async findInvitationByToken(token: string): Promise<TripInvitation> {
    const tokenHash = hashToken(token);
    const row = await this.invitationRepo.findOne({ where: { tokenHash } });
    if (!row || !hashesMatch(row.tokenHash, tokenHash)) {
      throw new NotFoundException(
        "This invitation link is invalid or has expired",
      );
    }
    return row;
  }

  private async notifyOrganizerOfAcceptance(
    itinerary: Itinerary,
    accepterId: string,
  ): Promise<void> {
    const [organizer, accepter] = await Promise.all([
      this.usersService.findById(itinerary.userId),
      this.usersService.findById(accepterId),
    ]);
    await this.tripChatService.postSystemMessage(
      itinerary.id,
      `${accepter?.name ?? "Someone"} joined the trip.`,
    );
    if (!organizer) return;
    const webAppUrl = this.configService.get("webAppUrl", { infer: true });
    await this.mailService
      .sendInvitationAccepted(
        organizer.email,
        accepter?.name ?? "Someone you invited",
        itinerary.title,
        `${webAppUrl}/trips/${itinerary.id}`,
      )
      .catch(() => undefined);
    await this.notificationsService.create(organizer.id, {
      type: "trip.invitation_accepted",
      title: "Invitation accepted",
      body: `${accepter?.name ?? "Someone you invited"} joined "${itinerary.title}".`,
      link: `/trips/${itinerary.id}`,
    });
  }

  private async sendInvitationEmail(
    itinerary: Itinerary,
    invitation: TripInvitation,
    token: string,
    inviteeUser: User | null,
  ): Promise<void> {
    const [inviter, destinationSummary] = await Promise.all([
      this.usersService.findById(invitation.invitedByUserId),
      this.destinationSummary(itinerary),
    ]);
    const webAppUrl = this.configService.get("webAppUrl", { infer: true });
    const delivered = await this.mailService.sendTripInvitation({
      to: invitation.email,
      inviterName: inviter?.name ?? "A LIBERIA360 traveler",
      tripTitle: itinerary.title,
      durationDays: itinerary.durationDays,
      destinationSummary,
      inviteUrl: `${webAppUrl}/invite/${token}`,
      hasAccount: Boolean(inviteeUser),
    });
    invitation.emailDelivered = delivered;
    await this.invitationRepo.save(invitation);
  }

  private toInvitationSummary(row: TripInvitation): InvitationSummary {
    return {
      id: row.id,
      email: row.email,
      status: this.computeStatus(row),
      invitee: row.invitee ? toPublicUser(row.invitee) : null,
      emailDelivered: row.emailDelivered,
      createdAt: row.createdAt,
      respondedAt: row.respondedAt,
      expiresAt: row.expiresAt,
    };
  }

  private computeStatus(row: TripInvitation): InvitationDisplayStatus {
    if (row.status === TripInvitationStatus.ACCEPTED) return "accepted";
    if (row.status === TripInvitationStatus.DECLINED) return "declined";
    if (row.expiresAt.getTime() < Date.now()) return "expired";
    if (row.viewedAt) return "viewed";
    return "pending";
  }

  private tripOverview(itinerary: Itinerary, destination: string): string {
    const kindLabel =
      itinerary.kind === ItineraryKind.WEEKEND ? "weekend getaway" : "trip";
    const interestsPart = itinerary.interests.length
      ? ` focused on ${itinerary.interests.slice(0, 3).join(", ")}`
      : "";
    const dayLabel = itinerary.durationDays === 1 ? "day" : "days";
    return `A ${itinerary.durationDays}-${dayLabel} ${kindLabel} to ${destination}${interestsPart}.`;
  }

  /** County name(s) covered by this trip's stops — the closest thing to
   * a "destination" field the itinerary model has (it doesn't store
   * literal start/end dates or a free-text destination, only durationDays
   * and a list of stop placeIds), used for both the invitation email and
   * preview. */
  private async destinationSummary(itinerary: Itinerary): Promise<string> {
    const placeIds = itinerary.stops.map((s) => s.placeId);
    if (placeIds.length === 0) return "Liberia";
    const places = await this.placeRepo.find({
      where: placeIds.map((id) => ({ id })),
      relations: ["county"],
    });
    const counties = Array.from(
      new Set(
        places.map((p) => p.county?.name).filter((n): n is string => !!n),
      ),
    );
    if (counties.length === 0) return "Liberia";
    if (counties.length <= 2) return counties.join(" & ");
    return `${counties.slice(0, 2).join(", ")} & more`;
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

  /** Weekend Explorer only now — generateTrip/previewTrip stopped
   * auto-matching places by interest/budget (see generateTrip's doc
   * comment); "what's reachable and worth doing nearby" is still exactly
   * what Weekend Explorer is for, so its own route-building keeps this. */
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

  private async toResponse(
    itinerary: Itinerary,
    resolvedPlaces: Place[],
    collaborators: PublicUser[],
  ): Promise<ItineraryResponse> {
    const owner = await this.usersService.findById(itinerary.userId);
    return {
      ...itinerary,
      coverImage: this.resolveCoverImage(itinerary),
      stops: this.mapStops(itinerary, resolvedPlaces),
      collaborators,
      admin: owner ? toPublicUser(owner) : null,
      status: this.computeTripStatus(itinerary),
    };
  }

  private mapStops(
    itinerary: Itinerary,
    resolvedPlaces: Place[],
  ): ItineraryStopWithPlace[] {
    const placeById = new Map(resolvedPlaces.map((p) => [p.id, p]));
    return itinerary.stops
      .map((s) => ({
        day: s.day,
        order: s.order,
        notes: s.notes,
        place: placeById.get(s.placeId),
      }))
      .filter((s): s is ItineraryStopWithPlace => !!s.place);
  }

  // Explicit cover image always wins; otherwise borrow the destination
  // place's first photo so a trip still looks like something in a feed
  // or card instead of a blank tile (Section 16: "the platform could also
  // provide a default destination image"). Never persisted onto the row
  // itself — see Itinerary.coverImage's doc comment.
  private resolveCoverImage(itinerary: Itinerary): string | null {
    return itinerary.coverImage ?? itinerary.destination?.images[0] ?? null;
  }

  // Best-effort lifecycle label (Section 20) — always derived from
  // startDate/endDate/cancelledAt at read time rather than stored, so it
  // can never drift out of sync with the dates that actually define it.
  // A trip with no dates at all (most AI-generated ones, today) reads as
  // UPCOMING — there's nothing to have started or finished yet.
  private computeTripStatus(itinerary: Itinerary): TripStatus {
    if (itinerary.cancelledAt) return TripStatus.CANCELLED;
    const now = Date.now();
    if (itinerary.endDate && itinerary.endDate.getTime() < now) {
      return TripStatus.COMPLETED;
    }
    if (itinerary.startDate && itinerary.startDate.getTime() <= now) {
      return TripStatus.ONGOING;
    }
    return TripStatus.UPCOMING;
  }

  private async toPublicSummary(
    itinerary: Itinerary,
  ): Promise<PublicTripSummary> {
    const [owner, participantCount] = await Promise.all([
      this.usersService.findById(itinerary.userId),
      this.collaboratorRepo.count({ where: { itineraryId: itinerary.id } }),
    ]);
    return {
      id: itinerary.id,
      title: itinerary.title,
      destination: itinerary.destination,
      description: itinerary.description,
      coverImage: this.resolveCoverImage(itinerary),
      startDate: itinerary.startDate,
      endDate: itinerary.endDate,
      status: this.computeTripStatus(itinerary),
      admin: owner ? toPublicUser(owner) : null,
      // +1 for the creator themself — collaboratorRepo only tracks
      // everyone *else*, but "8 people are joining this trip" (Section 8)
      // should count the admin too.
      participantCount: participantCount + 1,
      createdAt: itinerary.createdAt,
    };
  }

  /** "Trips You Can Join" (Section 5/17) — every PUBLIC, non-cancelled
   * trip, newest first. No auth required: this is exactly the discovery
   * surface a visitor with no account should be able to browse. */
  async findPublicTrips(query: QueryPublicTripsDto): Promise<{
    data: PublicTripSummary[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.itineraryRepo
      .createQueryBuilder("itinerary")
      .leftJoinAndSelect("itinerary.destination", "destination")
      .leftJoinAndSelect("destination.category", "category")
      .leftJoinAndSelect("destination.county", "county")
      .where("itinerary.visibility = :visibility", {
        visibility: TripVisibility.PUBLIC,
      })
      .andWhere("itinerary.cancelledAt IS NULL")
      .orderBy("itinerary.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    if (query.destinationPlaceId) {
      qb.andWhere("itinerary.destinationPlaceId = :destinationPlaceId", {
        destinationPlaceId: query.destinationPlaceId,
      });
    }

    const [rows, total] = await qb.getManyAndCount();
    const data = await Promise.all(rows.map((r) => this.toPublicSummary(r)));
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

  /** GET /itineraries/public/:id — unauthenticated by design (see
   * RestrictedTripPreview's doc comment for why a PRIVATE trip still gets
   * a 200 with a minimal body here instead of a 404). A non-member,
   * signed in or not, always lands here for a trip's "can I request to
   * join" view; the authenticated GET /itineraries/:id stays exactly the
   * full-access-or-404 gate it always was for everyone else. */
  async findPublicTripById(
    id: string,
  ): Promise<PublicTripDetail | RestrictedTripPreview> {
    const itinerary = await this.itineraryRepo.findOne({ where: { id } });
    if (!itinerary) {
      throw new NotFoundException(`Trip "${id}" not found`);
    }
    if (itinerary.visibility !== TripVisibility.PUBLIC) {
      return { id: itinerary.id, visibility: TripVisibility.PRIVATE };
    }
    const placeIds = itinerary.stops.map((s) => s.placeId);
    const places = placeIds.length
      ? await this.placeRepo.find({
          where: placeIds.map((id) => ({ id })),
          relations: ["category", "county"],
        })
      : [];
    const summary = await this.toPublicSummary(itinerary);
    return { ...summary, stops: this.mapStops(itinerary, places) };
  }

  // ---------------------------------------------------------------------
  // Join requests (Section 6) — the public-trip counterpart to
  // TripInvitation above: here a signed-in stranger asks to get in,
  // rather than the owner reaching out. "Public should not necessarily
  // mean anyone automatically becomes a participant" — approval still
  // gates actual membership either way.
  // ---------------------------------------------------------------------

  /** A signed-in user asking to join a PUBLIC trip they don't already
   * belong to. Notifies the admin; approving/declining is their call. */
  async requestToJoin(
    userId: string,
    itineraryId: string,
  ): Promise<{ status: TripJoinRequestStatus }> {
    const itinerary = await this.itineraryRepo.findOne({
      where: { id: itineraryId },
    });
    if (!itinerary) {
      throw new NotFoundException(`Trip "${itineraryId}" not found`);
    }
    if (itinerary.visibility !== TripVisibility.PUBLIC) {
      throw new ForbiddenException(
        "This trip is private — ask the trip admin for an invitation instead.",
      );
    }
    if (itinerary.userId === userId) {
      throw new BadRequestException("You already own this trip");
    }
    const existingCollaborator = await this.collaboratorRepo.findOne({
      where: { itineraryId, userId },
    });
    if (existingCollaborator) {
      throw new ConflictException("You're already part of this trip");
    }

    let request = await this.joinRequestRepo.findOne({
      where: { itineraryId, userId },
    });
    if (request?.status === TripJoinRequestStatus.PENDING) {
      throw new ConflictException(
        "You already have a pending request to join this trip",
      );
    }
    if (request) {
      // Re-request after a decline — reuse the row rather than
      // accumulating duplicate history, same reuse-by-resend pattern as
      // createOrResendInvitation.
      request.status = TripJoinRequestStatus.PENDING;
      request.respondedAt = null;
    } else {
      request = this.joinRequestRepo.create({
        itineraryId,
        userId,
        status: TripJoinRequestStatus.PENDING,
      });
    }
    request = await this.joinRequestRepo.save(request);

    const requester = await this.usersService.findById(userId);
    await this.notificationsService.create(itinerary.userId, {
      type: "trip.join_requested",
      title: "New request to join your trip",
      body: `${requester?.name ?? "Someone"} wants to join "${itinerary.title}".`,
      link: `/trips/${itinerary.id}`,
    });
    return { status: request.status };
  }

  /** Owner-only: the join-request queue, newest first. */
  async listJoinRequests(
    ownerId: string,
    itineraryId: string,
  ): Promise<TripJoinRequestSummary[]> {
    await this.getOwned(ownerId, itineraryId);
    const rows = await this.joinRequestRepo.find({
      where: { itineraryId },
      order: { createdAt: "DESC" },
    });
    return rows.map((r) => ({
      id: r.id,
      user: toPublicUser(r.user),
      status: r.status,
      createdAt: r.createdAt,
      respondedAt: r.respondedAt,
    }));
  }

  /** Owner-only: approving materializes an ItineraryCollaborator row —
   * the exact same "now an actual participant" transition
   * acceptInvitationRow makes for an invitation accepted. */
  async approveJoinRequest(
    ownerId: string,
    itineraryId: string,
    requestId: string,
  ): Promise<TripJoinRequestSummary[]> {
    const itinerary = await this.getOwned(ownerId, itineraryId);
    const request = await this.assertRespondableJoinRequest(
      itineraryId,
      requestId,
    );

    request.status = TripJoinRequestStatus.APPROVED;
    request.respondedAt = new Date();
    await this.joinRequestRepo.save(request);

    const existingCollaborator = await this.collaboratorRepo.findOne({
      where: { itineraryId, userId: request.userId },
    });
    if (!existingCollaborator) {
      await this.collaboratorRepo.save(
        this.collaboratorRepo.create({
          itineraryId,
          userId: request.userId,
          invitedByUserId: ownerId,
        }),
      );
    }

    await this.tripChatService.postSystemMessage(
      itineraryId,
      `${request.user?.name ?? "Someone"} joined the trip.`,
    );
    await this.notificationsService.create(request.userId, {
      type: "trip.join_request_approved",
      title: "Join request approved",
      body: `Your request to join "${itinerary.title}" was approved.`,
      link: `/trips/${itinerary.id}`,
    });
    return this.listJoinRequests(ownerId, itineraryId);
  }

  /** Owner-only: declines without ever touching collaborators. */
  async declineJoinRequest(
    ownerId: string,
    itineraryId: string,
    requestId: string,
  ): Promise<TripJoinRequestSummary[]> {
    const itinerary = await this.getOwned(ownerId, itineraryId);
    const request = await this.assertRespondableJoinRequest(
      itineraryId,
      requestId,
    );
    request.status = TripJoinRequestStatus.DECLINED;
    request.respondedAt = new Date();
    await this.joinRequestRepo.save(request);

    await this.notificationsService.create(request.userId, {
      type: "trip.join_request_declined",
      title: "Join request declined",
      body: `Your request to join "${itinerary.title}" was declined.`,
      link: `/trips/${itinerary.id}`,
    });
    return this.listJoinRequests(ownerId, itineraryId);
  }

  private async assertRespondableJoinRequest(
    itineraryId: string,
    requestId: string,
  ): Promise<TripJoinRequest> {
    const request = await this.joinRequestRepo.findOne({
      where: { id: requestId, itineraryId },
    });
    if (!request) {
      throw new NotFoundException("Join request not found");
    }
    if (request.status !== TripJoinRequestStatus.PENDING) {
      throw new ConflictException(
        `This request has already been ${request.status}`,
      );
    }
    return request;
  }

  /** Owner-only, one-way — see Itinerary.cancelledAt's doc comment. The
   * trip stays visible (Section 20: "the group conversation and trip
   * memories can remain available... unless the product decides
   * otherwise"), just permanently labeled CANCELLED instead of hidden or
   * deleted outright. */
  async cancelTrip(
    userId: string,
    itineraryId: string,
  ): Promise<ItineraryResponse> {
    const itinerary = await this.getOwned(userId, itineraryId);
    itinerary.cancelledAt = new Date();
    await this.itineraryRepo.save(itinerary);
    await this.tripChatService.postSystemMessage(
      itineraryId,
      "This trip has been cancelled.",
    );
    return this.findOne(userId, itineraryId);
  }
}
