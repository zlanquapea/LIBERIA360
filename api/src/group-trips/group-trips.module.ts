import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ItineraryCollaborator } from "../itineraries/entities/itinerary-collaborator.entity";
import { Itinerary } from "../itineraries/entities/itinerary.entity";
import { NotificationsModule } from "../notifications/notifications.module";
import { TripChatModule } from "../trip-chat/trip-chat.module";
import { HostedTrip } from "./entities/hosted-trip.entity";
import { TripBookingPayment } from "./entities/trip-booking-payment.entity";
import { TripBooking } from "./entities/trip-booking.entity";
import { GroupTripsController } from "./group-trips.controller";
import { GroupTripsService } from "./group-trips.service";

export const GROUP_TRIP_ENTITIES = [
  HostedTrip,
  TripBooking,
  TripBookingPayment,
];

// No dependency on ItinerariesModule: that module depends on this one
// (to show hosting details and end bookings when a trip is cancelled).
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ...GROUP_TRIP_ENTITIES,
      Itinerary,
      ItineraryCollaborator,
    ]),
    NotificationsModule,
    TripChatModule,
  ],
  controllers: [GroupTripsController],
  providers: [GroupTripsService],
  exports: [GroupTripsService],
})
export class GroupTripsModule {}
