import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
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
  ],
})
export class AppModule {}
