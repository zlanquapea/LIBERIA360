import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ItinerariesService } from "./itineraries.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";

/** The invited person's side of the invitation lifecycle — deliberately a
 * separate top-level `/invitations` controller rather than nested under
 * `/itineraries/:id`, for two reasons: the token-based routes below must
 * be reachable (for the preview, at least) *without* the caller already
 * knowing the itinerary id, and this keeps them from ever colliding with
 * ItinerariesController's `:id` param matching. */
@ApiTags("Trip Invitations")
@Controller("invitations")
export class TripInvitationsController {
  constructor(private readonly itinerariesService: ItinerariesService) {}

  /** Public, unauthenticated — the invite-link landing page reads this
   * before the visitor has necessarily signed in or even has an account
   * yet (Section 2/9: preview basic info, no private trip content). */
  @Get("token/:token")
  getPreview(@Param("token") token: string) {
    return this.itinerariesService.getInvitationPreview(token);
  }

  /** Emailed-link flow: accept while holding the token. */
  @Post("token/:token/accept")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  acceptByToken(@CurrentUser() user: User, @Param("token") token: string) {
    return this.itinerariesService.acceptByToken(user.id, token);
  }

  /** Emailed-link flow: decline while holding the token. */
  @Post("token/:token/decline")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async declineByToken(
    @CurrentUser() user: User,
    @Param("token") token: string,
  ) {
    await this.itinerariesService.declineByToken(user.id, token);
  }

  /** "My Invitations" — every trip invite currently open for this
   * account (Section 5). */
  @Get("mine")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  listMine(@CurrentUser() user: User) {
    return this.itinerariesService.listMyInvitations(user.id);
  }

  /** In-app flow: accept an invitation already linked to this account —
   * no token needed (only its hash is ever stored — see
   * TripInvitation's doc comment). */
  @Post(":id/accept")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  acceptById(@CurrentUser() user: User, @Param("id") id: string) {
    return this.itinerariesService.acceptById(user.id, id);
  }

  /** In-app flow: decline an invitation already linked to this account. */
  @Post(":id/decline")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async declineById(@CurrentUser() user: User, @Param("id") id: string) {
    await this.itinerariesService.declineById(user.id, id);
  }
}
