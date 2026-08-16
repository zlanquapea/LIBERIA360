import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Itinerary } from "./entities/itinerary.entity";
import { ItineraryCollaborator } from "./entities/itinerary-collaborator.entity";
import { Place } from "../places/entities/place.entity";
import { UsersModule } from "../users/users.module";
import { ItinerariesService } from "./itineraries.service";
import { ItinerariesController } from "./itineraries.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([Itinerary, ItineraryCollaborator, Place]),
    UsersModule,
  ],
  controllers: [ItinerariesController],
  providers: [ItinerariesService],
  exports: [ItinerariesService],
})
export class ItinerariesModule {}
