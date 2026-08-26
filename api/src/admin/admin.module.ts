import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Place } from "../places/entities/place.entity";
import { Category } from "../categories/entities/category.entity";
import { County } from "../counties/entities/county.entity";
import { Activity } from "../activities/entities/activity.entity";
import { Business } from "../businesses/entities/business.entity";
import { BusinessContent } from "../business-content/entities/business-content.entity";
import { Creator } from "../creators/entities/creator.entity";
import { Event } from "../events/entities/event.entity";
import { Review } from "../reviews/entities/review.entity";
import { User } from "../users/entities/user.entity";
import { AnalyticsEvent } from "../analytics/entities/analytics-event.entity";
import { PlaceFreshnessReport } from "../freshness/entities/place-freshness-report.entity";
import { ContentReport } from "../reports/entities/content-report.entity";
import { Booking } from "../bookings/entities/booking.entity";
import { ReviewsModule } from "../reviews/reviews.module";
import { AuthModule } from "../auth/auth.module";
import { SecurityModule } from "../security/security.module";
import { AdminService } from "./admin.service";
import { AdminController } from "./admin.controller";
import { AdminContentService } from "./admin-content.service";
import { AdminContentController } from "./admin-content.controller";
import { AdminAnalyticsService } from "./admin-analytics.service";
import { AdminAnalyticsController } from "./admin-analytics.controller";
import { AdminTeamService } from "./admin-team.service";
import { AdminTeamController } from "./admin-team.controller";
import { AdminAuditModule } from "./admin-audit.module";
import { AdminAuditController } from "./admin-audit.controller";
import { AdminSecurityController } from "./admin-security.controller";
import { AdminUsersService } from "./admin-users.service";
import { AdminUsersController } from "./admin-users.controller";
import { AdminSystemService } from "./admin-system.service";
import { AdminSystemController } from "./admin-system.controller";
import { AdminSettingsController } from "./admin-settings.controller";
import { MailModule } from "../mail/mail.module";
import { SettingsModule } from "../settings/settings.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Place,
      Category,
      County,
      Activity,
      Business,
      BusinessContent,
      Creator,
      Event,
      Review,
      User,
      AnalyticsEvent,
      PlaceFreshnessReport,
      ContentReport,
      Booking,
    ]),
    AdminAuditModule,
    ReviewsModule,
    AuthModule,
    SecurityModule,
    MailModule,
    SettingsModule,
    NotificationsModule,
  ],
  controllers: [
    AdminController,
    AdminContentController,
    AdminAnalyticsController,
    AdminTeamController,
    AdminAuditController,
    AdminSecurityController,
    AdminUsersController,
    AdminSystemController,
    AdminSettingsController,
  ],
  providers: [
    AdminService,
    AdminContentService,
    AdminAnalyticsService,
    AdminTeamService,
    AdminUsersService,
    AdminSystemService,
  ],
})
export class AdminModule {}
