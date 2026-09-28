import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  PublicExplorerProfile,
  VisitedPlacesService,
} from "./visited-places.service";

// A signed-in traveler's opt-in public Explorer profile — see
// VisitedPlacesService.getPublicProfile for the 404-unless-opted-in gate.
@ApiTags("Explorer")
@Controller("explorers")
export class ExplorersController {
  constructor(private readonly visitedPlacesService: VisitedPlacesService) {}

  @Get(":userId")
  getPublicProfile(
    @Param("userId") userId: string,
  ): Promise<PublicExplorerProfile> {
    return this.visitedPlacesService.getPublicProfile(userId);
  }
}
