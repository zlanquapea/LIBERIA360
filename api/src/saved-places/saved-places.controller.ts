import {
  Body,
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
import { SyncSavedPlacesDto } from "./dto/sync-saved-places.dto";
import { SavedPlacesService } from "./saved-places.service";

// The account-side half of Saved / Bucket List — every route here needs an
// account, unlike the localStorage-only save/unsave itself. See
// SavedPlace's class doc for the merge-on-login story this exists for.
@ApiTags("Saved Places")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("saved-places")
export class SavedPlacesController {
  constructor(private readonly savedPlacesService: SavedPlacesService) {}

  @Get()
  async list(@CurrentUser() user: User): Promise<{ slugs: string[] }> {
    return { slugs: await this.savedPlacesService.listSlugsForUser(user.id) };
  }

  // Registered before the ":placeId" routes below — Nest matches routes
  // in declaration order for the same method, and "sync" would otherwise
  // be swallowed as a (nonexistent) placeId.
  //
  // Called once per login (useSavedPlaces' merge effect) with whatever
  // this device's local saved-slugs list held at the time — see
  // SavedPlacesService.syncFromDevice.
  @Post("sync")
  async sync(
    @CurrentUser() user: User,
    @Body() dto: SyncSavedPlacesDto,
  ): Promise<{ slugs: string[] }> {
    return {
      slugs: await this.savedPlacesService.syncFromDevice(user.id, dto.slugs),
    };
  }

  @Post(":placeId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async save(
    @CurrentUser() user: User,
    @Param("placeId") placeId: string,
  ): Promise<void> {
    await this.savedPlacesService.savePlace(user.id, placeId);
  }

  @Delete(":placeId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsave(
    @CurrentUser() user: User,
    @Param("placeId") placeId: string,
  ): Promise<void> {
    await this.savedPlacesService.unsavePlace(user.id, placeId);
  }
}
