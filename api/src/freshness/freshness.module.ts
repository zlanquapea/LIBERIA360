import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PlaceFreshnessReport } from "./entities/place-freshness-report.entity";
import { Place } from "../places/entities/place.entity";
import { FreshnessService } from "./freshness.service";
import { FreshnessController } from "./freshness.controller";

@Module({
  imports: [TypeOrmModule.forFeature([PlaceFreshnessReport, Place])],
  controllers: [FreshnessController],
  providers: [FreshnessService],
  exports: [FreshnessService],
})
export class FreshnessModule {}
