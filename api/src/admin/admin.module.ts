import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Place } from "../places/entities/place.entity";
import { Category } from "../categories/entities/category.entity";
import { County } from "../counties/entities/county.entity";
import { Activity } from "../activities/entities/activity.entity";
import { Business } from "../businesses/entities/business.entity";
import { Event } from "../events/entities/event.entity";
import { Review } from "../reviews/entities/review.entity";
import { AdminService } from "./admin.service";
import { AdminController } from "./admin.controller";
import { AdminContentService } from "./admin-content.service";
import { AdminContentController } from "./admin-content.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Place,
      Category,
      County,
      Activity,
      Business,
      Event,
      Review,
    ]),
  ],
  controllers: [AdminController, AdminContentController],
  providers: [AdminService, AdminContentService],
})
export class AdminModule {}
