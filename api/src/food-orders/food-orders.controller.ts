import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { FoodOrdersService } from "./food-orders.service";
import { CreateFoodOrderDto } from "./dto/create-food-order.dto";
import { RespondFoodOrderDto } from "./dto/respond-food-order.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { toPublicUser } from "../users/user.serializer";
import { FoodOrder } from "./entities/food-order.entity";

// Eager-loaded buyer/business.owner come through as raw User entities —
// strip passwordHash before anything leaves the API, same pattern as
// bookings/reviews/events.
function sanitize(order: FoodOrder) {
  return {
    ...order,
    buyer: order.buyer ? toPublicUser(order.buyer) : null,
    business: order.business
      ? {
          ...order.business,
          owner: order.business.owner
            ? toPublicUser(order.business.owner)
            : null,
        }
      : null,
  };
}

@ApiTags("Food Orders")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class FoodOrdersController {
  constructor(private readonly foodOrdersService: FoodOrdersService) {}

  @Post("businesses/:businessId/food-orders")
  async create(
    @CurrentUser() user: User,
    @Param("businessId") businessId: string,
    @Body() dto: CreateFoodOrderDto,
  ) {
    return sanitize(
      await this.foodOrdersService.create(user.id, businessId, dto),
    );
  }

  @Get("food-orders/mine")
  async findMine(@CurrentUser() user: User) {
    const orders = await this.foodOrdersService.findMine(user.id);
    return orders.map(sanitize);
  }

  @Get("businesses/:businessId/food-orders")
  async findForBusiness(
    @CurrentUser() user: User,
    @Param("businessId") businessId: string,
  ) {
    const orders = await this.foodOrdersService.findForBusiness(
      user.id,
      businessId,
    );
    return orders.map(sanitize);
  }

  @Patch("food-orders/:id/respond")
  async respond(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: RespondFoodOrderDto,
  ) {
    return sanitize(await this.foodOrdersService.respond(user.id, id, dto));
  }

  @Patch("food-orders/:id/cancel")
  async cancel(@CurrentUser() user: User, @Param("id") id: string) {
    return sanitize(await this.foodOrdersService.cancel(user.id, id));
  }
}
