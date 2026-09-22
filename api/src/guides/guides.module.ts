import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NotificationsModule } from "../notifications/notifications.module";
import { StorageModule } from "../uploads/storage/storage.module";
import { County } from "../counties/entities/county.entity";
import { GuideProfile } from "./entities/guide-profile.entity";
import { Experience } from "./entities/experience.entity";
import { GuideBooking } from "./entities/guide-booking.entity";
import { GuideReview } from "./entities/guide-review.entity";
import { GuidesController } from "./guides.controller";
import { GuidesService } from "./guides.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GuideProfile,
      Experience,
      GuideBooking,
      GuideReview,
      County,
    ]),
    NotificationsModule,
    StorageModule,
  ],
  controllers: [GuidesController],
  providers: [GuidesService],
  exports: [GuidesService],
})
export class GuidesModule {}
