import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Event } from "../events/entities/event.entity";
import { EventRsvp } from "../events/entities/event-rsvp.entity";
import { EventTicketOrder } from "../event-tickets/entities/event-ticket-order.entity";
import { User } from "../users/entities/user.entity";
import { MailModule } from "../mail/mail.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { EventNotificationDelivery } from "./entities/event-notification-delivery.entity";
import { EventNotificationsService } from "./event-notifications.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventNotificationDelivery,
      Event,
      EventRsvp,
      EventTicketOrder,
      User,
    ]),
    MailModule,
    NotificationsModule,
  ],
  providers: [EventNotificationsService],
  exports: [EventNotificationsService],
})
export class EventNotificationsModule {}
