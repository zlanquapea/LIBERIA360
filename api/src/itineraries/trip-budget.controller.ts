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
import { SaveTripBudgetDto } from "./trip-budget.dto";
import { TripBudgetService } from "./trip-budget.service";

@Controller("itineraries/:id/budget")
@UseGuards(JwtAuthGuard)
export class TripBudgetController {
  constructor(private readonly budgets: TripBudgetService) {}
  @Get()
  @Header("Cache-Control", "no-store")
  get(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.budgets.get(user.id, id);
  }
  @Put()
  save(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SaveTripBudgetDto,
  ) {
    return this.budgets.save(user.id, id, dto);
  }
}
