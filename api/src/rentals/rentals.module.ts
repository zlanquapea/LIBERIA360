import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Booking } from "../bookings/entities/booking.entity";
import { CarListingBlockedDate } from "../car-listings/entities/car-listing-blocked-date.entity";
import { CarListing } from "../car-listings/entities/car-listing.entity";
import { NotificationsModule } from "../notifications/notifications.module";
import { SafetyModule } from "../safety/safety.module";
import { CarRental } from "./entities/car-rental.entity";
import { RentalMessage } from "./entities/rental-message.entity";
import { RentalSettings } from "./entities/rental-settings.entity";
import { RentalsController } from "./rentals.controller";
import { RentalsService } from "./rentals.service";

export const RENTAL_ENTITIES = [CarRental, RentalMessage, RentalSettings];

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ...RENTAL_ENTITIES,
      CarListing,
      CarListingBlockedDate,
      Booking,
    ]),
    NotificationsModule,
    SafetyModule,
  ],
  controllers: [RentalsController],
  providers: [RentalsService],
  exports: [RentalsService],
})
export class RentalsModule {}
