import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Place } from "../places/entities/place.entity";
import { SavedPlace } from "./entities/saved-place.entity";
import { SavedPlacesController } from "./saved-places.controller";
import { SavedPlacesService } from "./saved-places.service";

@Module({
  imports: [TypeOrmModule.forFeature([SavedPlace, Place])],
  controllers: [SavedPlacesController],
  providers: [SavedPlacesService],
})
export class SavedPlacesModule {}
