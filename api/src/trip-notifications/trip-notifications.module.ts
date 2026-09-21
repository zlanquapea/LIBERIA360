import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Itinerary } from "../itineraries/entities/itinerary.entity";
import { ItineraryCollaborator } from "../itineraries/entities/itinerary-collaborator.entity";
import { MailModule } from "../mail/mail.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { TripNotificationDelivery } from "./entities/trip-notification-delivery.entity";
import { TripNotificationsService } from "./trip-notifications.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TripNotificationDelivery,
      Itinerary,
      ItineraryCollaborator,
    ]),
    MailModule,
    NotificationsModule,
  ],
  providers: [TripNotificationsService],
  exports: [TripNotificationsService],
})
export class TripNotificationsModule {}
