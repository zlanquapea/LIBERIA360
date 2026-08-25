import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Place } from "./entities/place.entity";
import { Category } from "../categories/entities/category.entity";
import { County } from "../counties/entities/county.entity";
import { BusinessesModule } from "../businesses/businesses.module";
import { PlacesService } from "./places.service";
import { PlacesController } from "./places.controller";

@Module({
  // BusinessesModule: PlacesService.submitPlace auto-claims a self-submitted
  // place as a Business on the submitter's behalf (see
  // BusinessesService.autoClaimSubmittedPlace) — no cycle, BusinessesModule
  // only depends on the Place entity directly, never on PlacesModule.
  imports: [
    TypeOrmModule.forFeature([Place, Category, County]),
    BusinessesModule,
  ],
  controllers: [PlacesController],
  providers: [PlacesService],
  exports: [PlacesService],
})
export class PlacesModule {}
