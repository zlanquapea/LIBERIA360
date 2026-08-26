import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AnalyticsEvent } from "./entities/analytics-event.entity";
import { Place } from "../places/entities/place.entity";
import { Business } from "../businesses/entities/business.entity";
import { Creator } from "../creators/entities/creator.entity";
import { Advertisement } from "../advertisements/entities/advertisement.entity";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsController } from "./analytics.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AnalyticsEvent,
      Place,
      Business,
      Creator,
      Advertisement,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
