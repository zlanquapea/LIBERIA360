import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MenuItem } from "./entities/menu-item.entity";
import { MenuSettings } from "./entities/menu-settings.entity";
import { Business } from "../businesses/entities/business.entity";
import { MenuItemsService } from "./menu-items.service";
import { MenuItemsController } from "./menu-items.controller";
import { MenuSettingsController } from "./menu-settings.controller";

@Module({
  imports: [TypeOrmModule.forFeature([MenuItem, MenuSettings, Business])],
  controllers: [MenuItemsController, MenuSettingsController],
  providers: [MenuItemsService],
  exports: [MenuItemsService],
})
export class MenuItemsModule {}
