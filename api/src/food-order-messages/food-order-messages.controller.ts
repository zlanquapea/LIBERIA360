import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { FoodOrderMessagesService } from "./food-order-messages.service";
import { CreateFoodOrderMessageDto } from "./dto/create-food-order-message.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { toPublicUser } from "../users/user.serializer";
import { FoodOrderMessage } from "./entities/food-order-message.entity";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

// `sender` comes through as an eager relation — strip passwordHash before
// anything leaves the API, same pattern as booking-messages.
function sanitize(message: FoodOrderMessage) {
  return {
    ...message,
    sender: message.sender ? toPublicUser(message.sender) : null,
  };
}

@ApiTags("Food Order Messages")
@Controller("food-orders/:orderId/messages")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class FoodOrderMessagesController {
  constructor(
    private readonly foodOrderMessagesService: FoodOrderMessagesService,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: User,
    @Param("orderId") orderId: string,
    @Body() dto: CreateFoodOrderMessageDto,
  ) {
    return sanitize(
      await this.foodOrderMessagesService.create(user.id, orderId, dto),
    );
  }

  @Get()
  async findForOrder(
    @CurrentUser() user: User,
    @Param("orderId") orderId: string,
  ) {
    const messages = await this.foodOrderMessagesService.findForOrder(
      user.id,
      orderId,
    );
    return messages.map(sanitize);
  }

  // Declared as a literal "read" path segment — same registration-order
  // reasoning as BookingMessagesController.markRead (there's no ":messageId"
  // route here to collide with, but the convention is kept for consistency).
  @Patch("read")
  async markRead(
    @CurrentUser() user: User,
    @Param("orderId") orderId: string,
  ): Promise<{ success: true }> {
    await this.foodOrderMessagesService.markRead(user.id, orderId);
    return { success: true };
  }
}
