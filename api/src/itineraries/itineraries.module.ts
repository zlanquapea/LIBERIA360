import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Itinerary } from "./entities/itinerary.entity";
import { ItineraryCollaborator } from "./entities/itinerary-collaborator.entity";
import { TripInvitation } from "./entities/trip-invitation.entity";
import { Place } from "../places/entities/place.entity";
import { UsersModule } from "../users/users.module";
import { MailModule } from "../mail/mail.module";
import { ItinerariesService } from "./itineraries.service";
import { ItinerariesController } from "./itineraries.controller";
import { TripInvitationsController } from "./trip-invitations.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Itinerary,
      ItineraryCollaborator,
      TripInvitation,
      Place,
    ]),
    UsersModule,
    MailModule,
  ],
  controllers: [ItinerariesController, TripInvitationsController],
  providers: [ItinerariesService],
  exports: [ItinerariesService],
})
export class ItinerariesModule {}
