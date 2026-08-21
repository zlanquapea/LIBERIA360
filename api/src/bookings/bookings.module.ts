import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Booking } from "./entities/booking.entity";
import { Business } from "../businesses/entities/business.entity";
import { Creator } from "../creators/entities/creator.entity";
import { BookingsService } from "./bookings.service";
import { BookingsController } from "./bookings.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Business, Creator])],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
