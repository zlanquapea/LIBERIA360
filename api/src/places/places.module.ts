import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Place } from "./entities/place.entity";
import { Category } from "../categories/entities/category.entity";
import { County } from "../counties/entities/county.entity";
import { BusinessesModule } from "../businesses/businesses.module";
import { PharmaciesModule } from "../pharmacies/pharmacies.module";
import { PlacesService } from "./places.service";
import { PlacesController } from "./places.controller";
import { NotificationsModule } from "../notifications/notifications.module";
import { UsersModule } from "../users/users.module";

@Module({
  // BusinessesModule/PharmaciesModule: PlacesService.submitPlace
  // auto-claims a self-submitted place as a Business (see
  // BusinessesService.autoClaimSubmittedPlace), and — for the dedicated
  // "Pharmacy" category — as a Pharmacy too (see
  // PharmaciesService.autoClaimSubmittedPlace). No cycle: neither module
  // depends on PlacesModule, only on the Place entity/DTO types directly.
  imports: [
    TypeOrmModule.forFeature([Place, Category, County]),
    BusinessesModule,
    PharmaciesModule,
    NotificationsModule,
    UsersModule,
  ],
  controllers: [PlacesController],
  providers: [PlacesService],
  exports: [PlacesService],
})
export class PlacesModule {}
