import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuthModule } from "../auth/auth.module";
import { StorageModule } from "../uploads/storage/storage.module";
import { County } from "../counties/entities/county.entity";
import { GuideProfile } from "./entities/guide-profile.entity";
import { Experience } from "./entities/experience.entity";
import { GuideBooking } from "./entities/guide-booking.entity";
import { GuideReview } from "./entities/guide-review.entity";
import { GuideMessage } from "./entities/guide-message.entity";
import { GuidesController } from "./guides.controller";
import { GuidesService } from "./guides.service";
import { GuideChatGateway } from "./guide-chat.gateway";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GuideProfile,
      Experience,
      GuideBooking,
      GuideReview,
      GuideMessage,
      County,
    ]),
    NotificationsModule,
    AuthModule,
    StorageModule,
  ],
  controllers: [GuidesController],
  providers: [GuidesService, GuideChatGateway],
  exports: [GuidesService],
})
export class GuidesModule {}
