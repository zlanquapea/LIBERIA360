import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FoodOrderMessage } from "./entities/food-order-message.entity";
import { FoodOrder } from "../food-orders/entities/food-order.entity";
import { FoodOrderMessagesService } from "./food-order-messages.service";
import { FoodOrderMessagesController } from "./food-order-messages.controller";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([FoodOrderMessage, FoodOrder]),
    NotificationsModule,
  ],
  controllers: [FoodOrderMessagesController],
  providers: [FoodOrderMessagesService],
})
export class FoodOrderMessagesModule {}
