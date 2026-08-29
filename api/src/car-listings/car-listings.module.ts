import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CarListing } from "./entities/car-listing.entity";
import { Business } from "../businesses/entities/business.entity";
import { CarListingsService } from "./car-listings.service";
import { CarListingsController } from "./car-listings.controller";
import { NotificationsModule } from "../notifications/notifications.module";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([CarListing, Business]),
    NotificationsModule,
    UsersModule,
  ],
  controllers: [CarListingsController],
  providers: [CarListingsService],
  exports: [CarListingsService],
})
export class CarListingsModule {}
