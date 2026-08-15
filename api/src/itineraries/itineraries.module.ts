import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Itinerary } from "./entities/itinerary.entity";
import { Place } from "../places/entities/place.entity";
import { ItinerariesService } from "./itineraries.service";
import { ItinerariesController } from "./itineraries.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Itinerary, Place])],
  controllers: [ItinerariesController],
  providers: [ItinerariesService],
  exports: [ItinerariesService],
})
export class ItinerariesModule {}
