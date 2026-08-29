import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Review } from "./entities/review.entity";
import { Place } from "../places/entities/place.entity";
import { Creator } from "../creators/entities/creator.entity";
import { CarListing } from "../car-listings/entities/car-listing.entity";
import { Booking } from "../bookings/entities/booking.entity";
import { ReviewsService } from "./reviews.service";
import { ReviewsController } from "./reviews.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([Review, Place, Creator, CarListing, Booking]),
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
