import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CarListing } from "./entities/car-listing.entity";
import { CarListingBlockedDate } from "./entities/car-listing-blocked-date.entity";
import { Business } from "../businesses/entities/business.entity";
import { County } from "../counties/entities/county.entity";
import { Booking } from "../bookings/entities/booking.entity";
import { CarListingsService } from "./car-listings.service";
import { CarListingsController } from "./car-listings.controller";
import { NotificationsModule } from "../notifications/notifications.module";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CarListing,
      CarListingBlockedDate,
      Business,
      County,
      Booking,
    ]),
    NotificationsModule,
    UsersModule,
  ],
  controllers: [CarListingsController],
  providers: [CarListingsService],
  exports: [CarListingsService],
})
export class CarListingsModule {}
