import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TravelerInfoSettings } from "./entities/traveler-info-settings.entity";
import { TravelerInfoController } from "./traveler-info.controller";
import { TravelerInfoService } from "./traveler-info.service";

@Module({
  imports: [TypeOrmModule.forFeature([TravelerInfoSettings])],
  controllers: [TravelerInfoController],
  providers: [TravelerInfoService],
})
export class TravelerInfoModule {}
