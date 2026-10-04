import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { SaveTripPackingDto } from "./trip-packing.dto";
import { TripPackingService } from "./trip-packing.service";
@Controller("itineraries/:id/packing")
@UseGuards(JwtAuthGuard)
export class TripPackingController {
  constructor(private readonly packing: TripPackingService) {}
  @Get()
  @Header("Cache-Control", "no-store")
  get(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.packing.get(user.id, id);
  }
  @Put()
  save(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SaveTripPackingDto,
  ) {
    return this.packing.save(user.id, id, dto);
  }
}
