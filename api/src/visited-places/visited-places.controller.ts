import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { User } from "../users/entities/user.entity";
import {
  ExplorerProgress,
  VisitedPlacesService,
} from "./visited-places.service";

// The account-side "Explorer" feature — self-reported visited places, the
// raw material VisitedPlacesService.getExplorerProgress computes counts
// and badges from. Deliberately not named "Bucket List" — see
// VisitedPlace's own doc comment.
@ApiTags("Explorer")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("visited-places")
export class VisitedPlacesController {
  constructor(private readonly visitedPlacesService: VisitedPlacesService) {}

  // Registered before ":placeId" below for the same reason
  // SavedPlacesController documents on its own "sync" route.
  @Get("progress")
  getProgress(@CurrentUser() user: User): Promise<ExplorerProgress> {
    return this.visitedPlacesService.getExplorerProgress(user.id);
  }

  @Get()
  async list(@CurrentUser() user: User): Promise<{ placeIds: string[] }> {
    return {
      placeIds: await this.visitedPlacesService.listMyVisitedPlaceIds(user.id),
    };
  }

  @Post(":placeId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async markVisited(
    @CurrentUser() user: User,
    @Param("placeId") placeId: string,
  ): Promise<void> {
    await this.visitedPlacesService.markVisited(user.id, placeId);
  }

  @Delete(":placeId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async unmarkVisited(
    @CurrentUser() user: User,
    @Param("placeId") placeId: string,
  ): Promise<void> {
    await this.visitedPlacesService.unmarkVisited(user.id, placeId);
  }
}
