import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FoodOrder } from "./entities/food-order.entity";
import { Business } from "../businesses/entities/business.entity";
import { MenuItem } from "../menu-items/entities/menu-item.entity";
import { FoodOrdersService } from "./food-orders.service";
import { FoodOrdersController } from "./food-orders.controller";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([FoodOrder, Business, MenuItem]),
    NotificationsModule,
  ],
  controllers: [FoodOrdersController],
  providers: [FoodOrdersService],
})
export class FoodOrdersModule {}
