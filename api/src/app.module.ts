import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard, seconds } from "@nestjs/throttler";
import { TypeOrmModule, TypeOrmModuleOptions } from "@nestjs/typeorm";
import configuration, { AppConfig } from "./config/configuration";
import { HealthModule } from "./health/health.module";
import { Place } from "./places/entities/place.entity";
import { Activity } from "./activities/entities/activity.entity";
import { Category } from "./categories/entities/category.entity";
import { County } from "./counties/entities/county.entity";
import { PlacesModule } from "./places/places.module";
import { CountiesModule } from "./counties/counties.module";
import { CategoriesModule } from "./categories/categories.module";
import { User } from "./users/entities/user.entity";
import { UsersModule } from "./users/users.module";
import { AuthModule } from "./auth/auth.module";
import { Review } from "./reviews/entities/review.entity";
import { ReviewsModule } from "./reviews/reviews.module";
import { UploadsModule } from "./uploads/uploads.module";
import { Business } from "./businesses/entities/business.entity";
import { BusinessesModule } from "./businesses/businesses.module";
import { Creator } from "./creators/entities/creator.entity";
import { CreatorsModule } from "./creators/creators.module";
import { Event } from "./events/entities/event.entity";
import { EventsModule } from "./events/events.module";
import { Itinerary } from "./itineraries/entities/itinerary.entity";
import { ItinerariesModule } from "./itineraries/itineraries.module";
import { PushSubscription } from "./push/entities/push-subscription.entity";
import { PushModule } from "./push/push.module";
import { Booking } from "./bookings/entities/booking.entity";
import { BookingsModule } from "./bookings/bookings.module";
import { AnalyticsEvent } from "./analytics/entities/analytics-event.entity";
import { AnalyticsModule } from "./analytics/analytics.module";
import { SponsoredPlacement } from "./sponsored-placements/entities/sponsored-placement.entity";
import { SponsoredPlacementsModule } from "./sponsored-placements/sponsored-placements.module";
import { AdminModule } from "./admin/admin.module";
import { PlaceFreshnessReport } from "./freshness/entities/place-freshness-report.entity";
import { FreshnessModule } from "./freshness/freshness.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    // Global default: generous enough not to bother normal browsing/API
    // use. Password- and code-guessing endpoints (login, 2fa/verify) get
    // a much stricter override via @Throttle — see auth.controller.ts.
    ThrottlerModule.forRoot([
      { name: "default", ttl: seconds(60), limit: 120 },
    ]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService<AppConfig, true>,
      ): TypeOrmModuleOptions => {
        const database = configService.get("database", { infer: true });
        return {
          type: "postgres",
          ...database,
          entities: [
            Place,
            Activity,
            Category,
            County,
            User,
            Review,
            Business,
            Creator,
            Event,
            Itinerary,
            PushSubscription,
            Booking,
            AnalyticsEvent,
            SponsoredPlacement,
            PlaceFreshnessReport,
          ],
          migrations: ["dist/database/migrations/*.js"],
          autoLoadEntities: true,
        };
      },
    }),
    HealthModule,
    PlacesModule,
    CountiesModule,
    CategoriesModule,
    UsersModule,
    AuthModule,
    ReviewsModule,
    UploadsModule,
    BusinessesModule,
    CreatorsModule,
    EventsModule,
    ItinerariesModule,
    PushModule,
    BookingsModule,
    AnalyticsModule,
    SponsoredPlacementsModule,
    AdminModule,
    FreshnessModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
