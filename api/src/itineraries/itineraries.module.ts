import { TripVotingController } from "./trip-voting.controller";
import { TripActivityController } from "./trip-activity.controller";
import { TripActivityService } from "./trip-activity.service";
import { TripVotingService } from "./trip-voting.service";
import { Module } from "@nestjs/common";
import { TripPackingController } from "./trip-packing.controller";
import { TripPackingService } from "./trip-packing.service";
import { TripBudgetController } from "./trip-budget.controller";
import { TripBudgetService } from "./trip-budget.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Itinerary } from "./entities/itinerary.entity";
import { ItineraryCollaborator } from "./entities/itinerary-collaborator.entity";
import { TripInvitation } from "./entities/trip-invitation.entity";
import { TripJoinRequest } from "./entities/trip-join-request.entity";
import { Place } from "../places/entities/place.entity";
import { Event } from "../events/entities/event.entity";
import { CarListing } from "../car-listings/entities/car-listing.entity";
import { UsersModule } from "../users/users.module";
import { MailModule } from "../mail/mail.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { TripChatModule } from "../trip-chat/trip-chat.module";
import { GroupTripsModule } from "../group-trips/group-trips.module";
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
      Event,
      CarListing,
    ]),
    UsersModule,
    MailModule,
    NotificationsModule,
    TripChatModule,
    GroupTripsModule,
  ],
  controllers: [
    TripActivityController,
    TripVotingController,
    TripPackingController,
    TripBudgetController,
    ItinerariesController,
    TripInvitationsController,
    TripPreviewController,
  ],
  providers: [
    TripActivityService,
    TripVotingService,
    ItinerariesService,
    TripBudgetService,
    TripPackingService,
  ],
  exports: [ItinerariesService],
})
export class ItinerariesModule {}
