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
import { GenerateTripDto } from "./dto/generate-trip.dto";
import { GenerateWeekendDto } from "./dto/generate-weekend.dto";
import { CreateInvitationsDto } from "./dto/create-invitations.dto";
import { SearchInvitableUsersDto } from "./dto/search-invitable-users.dto";
import { RenameItineraryDto } from "./dto/rename-itinerary.dto";
import { AddStopDto } from "./dto/add-stop.dto";
import { UpdateStopDto } from "./dto/update-stop.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

@ApiTags("Itineraries")
@Controller("itineraries")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class ItinerariesController {
  constructor(private readonly itinerariesService: ItinerariesService) {}

  /** "Build My Liberia Trip" (Tech Spec §4.3). */
  @Post()
  generateTrip(@CurrentUser() user: User, @Body() dto: GenerateTripDto) {
    return this.itinerariesService.generateTrip(user.id, dto);
  }

  /** Weekend Explorer (Tech Spec §3.2). */
  @Post("weekend")
  generateWeekend(@CurrentUser() user: User, @Body() dto: GenerateWeekendDto) {
    return this.itinerariesService.generateWeekend(user.id, dto);
  }

  @Get()
  findMine(@CurrentUser() user: User) {
    return this.itinerariesService.findMine(user.id);
  }

  /** Trips someone else invited this user onto as a collaborator. */
  @Get("shared-with-me")
  findSharedWithMe(@CurrentUser() user: User) {
    return this.itinerariesService.findSharedWithMe(user.id);
  }

  @Get(":id")
  findOne(@CurrentUser() user: User, @Param("id") id: string) {
    return this.itinerariesService.findOne(user.id, id);
  }

  /** Owner or any collaborator can rename the trip. */
  @Patch(":id")
  renameTrip(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: RenameItineraryDto,
  ) {
    return this.itinerariesService.renameTrip(user.id, id, dto.title);
  }

  /** Owner-only, permanent — deletes the trip and everyone's access to it. */
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTrip(@CurrentUser() user: User, @Param("id") id: string) {
    await this.itinerariesService.deleteTrip(user.id, id);
  }

  /** Owner-only: "People you may want to invite" — platform users
   * matching the search, minus anyone already on this trip. */
  @Get(":id/invitations/search-people")
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
  listInvitations(@CurrentUser() user: User, @Param("id") id: string) {
    return this.itinerariesService.listInvitations(user.id, id);
  }

  /** Owner-only: resend a still-pending invite (fresh token, fresh
   * expiry). */
  @Post(":id/invitations/:invitationId/resend")
  resendInvitation(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Param("invitationId") invitationId: string,
  ) {
    return this.itinerariesService.resendInvitation(user.id, id, invitationId);
  }

  /** Owner-only: revoke an invitation outright. */
  @Delete(":id/invitations/:invitationId")
  cancelInvitation(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Param("invitationId") invitationId: string,
  ) {
    return this.itinerariesService.cancelInvitation(user.id, id, invitationId);
  }

  /** Owner removes anyone, or a collaborator removes themself ("leave this trip"). */
  @Delete(":id/collaborators/:userId")
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
  addStop(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: AddStopDto,
  ) {
    return this.itinerariesService.addStop(user.id, id, dto);
  }

  /** Owner or any collaborator can edit a stop's notes. */
  @Patch(":id/stops/:placeId")
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
  removeStop(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Param("placeId") placeId: string,
  ) {
    return this.itinerariesService.removeStop(user.id, id, placeId);
  }
}
