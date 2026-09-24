import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Booking } from "./entities/booking.entity";
import { Business } from "../businesses/entities/business.entity";
import { Creator } from "../creators/entities/creator.entity";
import { CarListing } from "../car-listings/entities/car-listing.entity";
import { CarListingBlockedDate } from "../car-listings/entities/car-listing-blocked-date.entity";
import { BookingsService } from "./bookings.service";
import { BookingsController } from "./bookings.controller";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Booking,
      Business,
      Creator,
      CarListing,
      CarListingBlockedDate,
    ]),
    NotificationsModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
