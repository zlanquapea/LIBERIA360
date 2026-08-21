import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ContentReport } from "./entities/content-report.entity";
import { Review } from "../reviews/entities/review.entity";
import { Event } from "../events/entities/event.entity";
import { Business } from "../businesses/entities/business.entity";
import { ReportsService } from "./reports.service";
import { ReportsController } from "./reports.controller";

@Module({
  imports: [TypeOrmModule.forFeature([ContentReport, Review, Event, Business])],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
