import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Itinerary } from "./entities/itinerary.entity";
import { ItineraryCollaborator } from "./entities/itinerary-collaborator.entity";
import { TripInvitation } from "./entities/trip-invitation.entity";
import { TripJoinRequest } from "./entities/trip-join-request.entity";
import { Place } from "../places/entities/place.entity";
import { UsersModule } from "../users/users.module";
import { MailModule } from "../mail/mail.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ItinerariesService } from "./itineraries.service";
import { ItinerariesController } from "./itineraries.controller";
import { TripInvitationsController } from "./trip-invitations.controller";
import { TripPreviewController } from "./trip-preview.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Itinerary,
      ItineraryCollaborator,
      TripInvitation,
      TripJoinRequest,
      Place,
    ]),
    UsersModule,
    MailModule,
    NotificationsModule,
  ],
  controllers: [
    ItinerariesController,
    TripInvitationsController,
    TripPreviewController,
  ],
  providers: [ItinerariesService],
  exports: [ItinerariesService],
})
export class ItinerariesModule {}
