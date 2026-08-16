import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BookingMessage } from "./entities/booking-message.entity";
import { Booking } from "../bookings/entities/booking.entity";
import { BookingMessagesService } from "./booking-messages.service";
import { BookingMessagesController } from "./booking-messages.controller";

@Module({
  imports: [TypeOrmModule.forFeature([BookingMessage, Booking])],
  controllers: [BookingMessagesController],
  providers: [BookingMessagesService],
})
export class BookingMessagesModule {}
