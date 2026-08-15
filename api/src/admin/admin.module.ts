import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Place } from "../places/entities/place.entity";
import { Business } from "../businesses/entities/business.entity";
import { Review } from "../reviews/entities/review.entity";
import { AdminService } from "./admin.service";
import { AdminController } from "./admin.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Place, Business, Review])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
