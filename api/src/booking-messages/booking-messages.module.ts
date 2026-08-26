import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BookingMessage } from "./entities/booking-message.entity";
import { Booking } from "../bookings/entities/booking.entity";
import { BookingMessagesService } from "./booking-messages.service";
import { BookingMessagesController } from "./booking-messages.controller";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([BookingMessage, Booking]),
    NotificationsModule,
  ],
  controllers: [BookingMessagesController],
  providers: [BookingMessagesService],
})
export class BookingMessagesModule {}
