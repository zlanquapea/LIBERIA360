import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Place } from "../places/entities/place.entity";
import { County } from "../counties/entities/county.entity";
import { User } from "../users/entities/user.entity";
import { VisitedPlace } from "./entities/visited-place.entity";
import { VisitedPlacesController } from "./visited-places.controller";
import { ExplorersController } from "./explorers.controller";
import { VisitedPlacesService } from "./visited-places.service";

@Module({
  imports: [TypeOrmModule.forFeature([VisitedPlace, Place, County, User])],
  controllers: [VisitedPlacesController, ExplorersController],
  providers: [VisitedPlacesService],
})
export class VisitedPlacesModule {}
