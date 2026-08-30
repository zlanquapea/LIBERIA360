import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Event } from "../events/entities/event.entity";
import { User } from "../users/entities/user.entity";
import { EventTicketsController } from "./event-tickets.controller";
import { EventTicketsService } from "./event-tickets.service";
import { EventTicketOrder } from "./entities/event-ticket-order.entity";
import { EventTicketInstance } from "./entities/event-ticket-instance.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Event,
      User,
      EventTicketOrder,
      EventTicketInstance,
    ]),
  ],
  controllers: [EventTicketsController],
  providers: [EventTicketsService],
})
export class EventTicketsModule {}
