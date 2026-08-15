import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ItinerariesService } from "./itineraries.service";
import { GenerateTripDto } from "./dto/generate-trip.dto";
import { GenerateWeekendDto } from "./dto/generate-weekend.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";

@Controller("itineraries")
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

  @Get(":id")
  findOne(@CurrentUser() user: User, @Param("id") id: string) {
    return this.itinerariesService.findOne(user.id, id);
  }
}
