import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Event } from "../events/entities/event.entity";
import { User } from "../users/entities/user.entity";
import { UsersModule } from "../users/users.module";
import { MailModule } from "../mail/mail.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { EventTicketsController } from "./event-tickets.controller";
import { TicketTransfersController } from "./ticket-transfers.controller";
import { EventTicketsService } from "./event-tickets.service";
import { EventTicketOrder } from "./entities/event-ticket-order.entity";
import { EventTicketInstance } from "./entities/event-ticket-instance.entity";
import { TicketTransfer } from "./entities/ticket-transfer.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Event,
      User,
      EventTicketOrder,
      EventTicketInstance,
      TicketTransfer,
    ]),
    UsersModule,
    MailModule,
    NotificationsModule,
  ],
  controllers: [EventTicketsController, TicketTransfersController],
  providers: [EventTicketsService],
})
export class EventTicketsModule {}
