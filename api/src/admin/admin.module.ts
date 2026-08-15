import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Place } from "../places/entities/place.entity";
import { Category } from "../categories/entities/category.entity";
import { County } from "../counties/entities/county.entity";
import { Activity } from "../activities/entities/activity.entity";
import { Business } from "../businesses/entities/business.entity";
import { Event } from "../events/entities/event.entity";
import { Review } from "../reviews/entities/review.entity";
import { AnalyticsEvent } from "../analytics/entities/analytics-event.entity";
import { AdminService } from "./admin.service";
import { AdminController } from "./admin.controller";
import { AdminContentService } from "./admin-content.service";
import { AdminContentController } from "./admin-content.controller";
import { AdminAnalyticsService } from "./admin-analytics.service";
import { AdminAnalyticsController } from "./admin-analytics.controller";

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
      AnalyticsEvent,
    ]),
  ],
  controllers: [
    AdminController,
    AdminContentController,
    AdminAnalyticsController,
  ],
  providers: [AdminService, AdminContentService, AdminAnalyticsService],
})
export class AdminModule {}
