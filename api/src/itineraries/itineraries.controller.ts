import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ItinerariesService } from "./itineraries.service";
import { CreateTripDto } from "./dto/create-trip.dto";
import { GenerateWeekendDto } from "./dto/generate-weekend.dto";
import { QueryPublicTripsDto } from "./dto/query-public-trips.dto";
import { CreateInvitationsDto } from "./dto/create-invitations.dto";
import { SearchInvitableUsersDto } from "./dto/search-invitable-users.dto";
import { RenameItineraryDto } from "./dto/rename-itinerary.dto";
import { AddStopDto } from "./dto/add-stop.dto";
import { UpdateStopDto } from "./dto/update-stop.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

// No class-level guard, unlike before — "Trips You Can Join" (Section 5)
// needs a couple of routes a visitor with no account can reach at all
// (findPublicTrips/findPublicTripById below), same reasoning as
// PlacesController splitting its public GETs from its owner-gated
// writes. Every other route here still carries its own
// @ApiBearerAuth()/@UseGuards(JwtAuthGuard) exactly as before.
@ApiTags("Itineraries")
@Controller("itineraries")
export class ItinerariesController {
  constructor(private readonly itinerariesService: ItinerariesService) {}

  /** "Build My Liberia Trip" (Tech Spec §4.3) — now also the "create a
   * social trip" endpoint (Aug 2026 spec): name, destination, and
   * visibility are all required on CreateTripDto, unlike the preview-only
   * GenerateTripDto below. */
  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  generateTrip(@CurrentUser() user: User, @Body() dto: CreateTripDto) {
    return this.itinerariesService.generateTrip(user.id, dto);
  }

  /** Weekend Explorer (Tech Spec §3.2). */
  @Post("weekend")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  generateWeekend(@CurrentUser() user: User, @Body() dto: GenerateWeekendDto) {
    return this.itinerariesService.generateWeekend(user.id, dto);
  }

  // Public discovery (Section 5/17) — unauthenticated, and declared
  // before ":id" below so "public" is never parsed as a trip id (same
  // ordering rule PlacesController's "mine" route documents).
  @Get("public")
  findPublicTrips(@Query() query: QueryPublicTripsDto) {
    return this.itinerariesService.findPublicTrips(query);
  }

  /** A public trip's own basic-info view — what a stranger (signed in or
   * not) gets, distinct from the full authenticated view below. Also
   * where a real *private* trip's link resolves to a restricted-access
   * marker instead of a 404 — see RestrictedTripPreview's doc comment. */
  @Get("public/:id")
  findPublicTripById(@Param("id") id: string) {
    return this.itinerariesService.findPublicTripById(id);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  findMine(@CurrentUser() user: User) {
    return this.itinerariesService.findMine(user.id);
  }

  /** Trips someone else invited this user onto as a collaborator. */
  @Get("shared-with-me")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  findSharedWithMe(@CurrentUser() user: User) {
    return this.itinerariesService.findSharedWithMe(user.id);
  }

  @Get(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  findOne(@CurrentUser() user: User, @Param("id") id: string) {
    return this.itinerariesService.findOne(user.id, id);
  }

  /** Owner or any collaborator can rename the trip. */
  @Patch(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  renameTrip(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: RenameItineraryDto,
  ) {
    return this.itinerariesService.renameTrip(user.id, id, dto.title);
  }

  /** Owner-only, permanent — deletes the trip and everyone's access to it. */
  @Delete(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTrip(@CurrentUser() user: User, @Param("id") id: string) {
    await this.itinerariesService.deleteTrip(user.id, id);
  }

  /** Owner-only — one-way; see Itinerary.cancelledAt's doc comment. */
  @Post(":id/cancel")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  cancelTrip(@CurrentUser() user: User, @Param("id") id: string) {
    return this.itinerariesService.cancelTrip(user.id, id);
  }

  /** A signed-in stranger asking to join a PUBLIC trip (Section 6) — the
   * opposite direction from an invitation. */
  @Post(":id/join-requests")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  requestToJoin(@CurrentUser() user: User, @Param("id") id: string) {
    return this.itinerariesService.requestToJoin(user.id, id);
  }

  /** Owner-only: the join-request queue. */
  @Get(":id/join-requests")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  listJoinRequests(@CurrentUser() user: User, @Param("id") id: string) {
    return this.itinerariesService.listJoinRequests(user.id, id);
  }

  /** Owner-only: approve — the requester becomes an actual participant. */
  @Post(":id/join-requests/:requestId/approve")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  approveJoinRequest(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Param("requestId") requestId: string,
  ) {
    return this.itinerariesService.approveJoinRequest(user.id, id, requestId);
  }

  /** Owner-only: decline. */
  @Post(":id/join-requests/:requestId/decline")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  declineJoinRequest(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Param("requestId") requestId: string,
  ) {
    return this.itinerariesService.declineJoinRequest(user.id, id, requestId);
  }

  /** Owner-only: "People you may want to invite" — platform users
   * matching the search, minus anyone already on this trip. */
  @Get(":id/invitations/search-people")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  searchInvitablePeople(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Query() query: SearchInvitableUsersDto,
  ) {
    return this.itinerariesService.searchInvitablePeople(user.id, id, query.q);
  }

  /** Owner-only: invite one or many people at once — each either an
   * existing platform user (userId) or a bare email address. */
  @Post(":id/invitations")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  createInvitations(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: CreateInvitationsDto,
  ) {
    return this.itinerariesService.createInvitations(user.id, id, dto.invitees);
  }

  /** Owner-only: the People/Participants panel's invitation list, with
   * each one's current status. */
  @Get(":id/invitations")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  listInvitations(@CurrentUser() user: User, @Param("id") id: string) {
    return this.itinerariesService.listInvitations(user.id, id);
  }

  /** Owner-only: resend a still-pending invite (fresh token, fresh
   * expiry). */
  @Post(":id/invitations/:invitationId/resend")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  resendInvitation(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Param("invitationId") invitationId: string,
  ) {
    return this.itinerariesService.resendInvitation(user.id, id, invitationId);
  }

  /** Owner-only: revoke an invitation outright. */
  @Delete(":id/invitations/:invitationId")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  cancelInvitation(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Param("invitationId") invitationId: string,
  ) {
    return this.itinerariesService.cancelInvitation(user.id, id, invitationId);
  }

  /** Owner removes anyone, or a collaborator removes themself ("leave this trip"). */
  @Delete(":id/collaborators/:userId")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  removeCollaborator(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Param("userId") collaboratorUserId: string,
  ) {
    return this.itinerariesService.removeCollaborator(
      user.id,
      id,
      collaboratorUserId,
    );
  }

  /** Owner or any collaborator can add a stop. */
  @Post(":id/stops")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  addStop(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: AddStopDto,
  ) {
    return this.itinerariesService.addStop(user.id, id, dto);
  }

  /** Owner or any collaborator can edit a stop's notes. */
  @Patch(":id/stops/:placeId")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  updateStop(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Param("placeId") placeId: string,
    @Body() dto: UpdateStopDto,
  ) {
    return this.itinerariesService.updateStop(user.id, id, placeId, dto);
  }

  /** Owner or any collaborator can remove a stop. */
  @Delete(":id/stops/:placeId")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  removeStop(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Param("placeId") placeId: string,
  ) {
    return this.itinerariesService.removeStop(user.id, id, placeId);
  }
}
