import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ContentReport } from "./entities/content-report.entity";
import { Review } from "../reviews/entities/review.entity";
import { Event } from "../events/entities/event.entity";
import { Business } from "../businesses/entities/business.entity";
import { ReportsService } from "./reports.service";
import { ReportsController } from "./reports.controller";
import { SettingsModule } from "../settings/settings.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { MailModule } from "../mail/mail.module";
import { PushModule } from "../push/push.module";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([ContentReport, Review, Event, Business]),
    SettingsModule,
    NotificationsModule,
    MailModule,
    PushModule,
    UsersModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
