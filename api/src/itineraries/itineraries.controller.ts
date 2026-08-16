import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ItinerariesService } from "./itineraries.service";
import { GenerateTripDto } from "./dto/generate-trip.dto";
import { GenerateWeekendDto } from "./dto/generate-weekend.dto";
import { InviteCollaboratorDto } from "./dto/invite-collaborator.dto";
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

  /** Owner-only: invite a collaborator by email. */
  @Post(":id/collaborators")
  inviteCollaborator(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: InviteCollaboratorDto,
  ) {
    return this.itinerariesService.inviteCollaborator(user.id, id, dto.email);
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
