import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MenuItem } from "./entities/menu-item.entity";
import { Business } from "../businesses/entities/business.entity";
import { MenuItemsService } from "./menu-items.service";
import { MenuItemsController } from "./menu-items.controller";

@Module({
  imports: [TypeOrmModule.forFeature([MenuItem, Business])],
  controllers: [MenuItemsController],
  providers: [MenuItemsService],
  exports: [MenuItemsService],
})
export class MenuItemsModule {}
