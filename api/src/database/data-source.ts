import "reflect-metadata";
import { DataSource } from "typeorm";
import { config } from "dotenv";
import { Place } from "../places/entities/place.entity";
import { Activity } from "../activities/entities/activity.entity";
import { Category } from "../categories/entities/category.entity";
import { County } from "../counties/entities/county.entity";
import { User } from "../users/entities/user.entity";
import { Review } from "../reviews/entities/review.entity";
import { Business } from "../businesses/entities/business.entity";
import { Creator } from "../creators/entities/creator.entity";
import { Event } from "../events/entities/event.entity";
import { Itinerary } from "../itineraries/entities/itinerary.entity";
import { ItineraryCollaborator } from "../itineraries/entities/itinerary-collaborator.entity";
import { PushSubscription } from "../push/entities/push-subscription.entity";
import { Booking } from "../bookings/entities/booking.entity";
import { AnalyticsEvent } from "../analytics/entities/analytics-event.entity";
import { SponsoredPlacement } from "../sponsored-placements/entities/sponsored-placement.entity";
import { PlaceFreshnessReport } from "../freshness/entities/place-freshness-report.entity";
import { BookingMessage } from "../booking-messages/entities/booking-message.entity";

config();

/**
 * Standalone DataSource for the TypeORM CLI (migration:generate/run/revert)
 * and the seed script — these run outside the Nest DI context, so they read
 * env vars directly instead of going through ConfigService.
 */
export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST ?? "localhost",
  port: parseInt(process.env.DB_PORT ?? "5432", 10),
  username: process.env.DB_USERNAME ?? "liberia360",
  password: process.env.DB_PASSWORD ?? "liberia360",
  database: process.env.DB_DATABASE ?? "liberia360",
  // Same reasoning as app.module.ts's TypeOrmModule setup — a free managed
  // Postgres (Neon, Render, Heroku, ...) requires TLS to even accept a
  // connection, which this CLI-only DataSource (migrations, seed script)
  // needs independently since it doesn't go through ConfigService.
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
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
    ItineraryCollaborator,
    PushSubscription,
    Booking,
    AnalyticsEvent,
    SponsoredPlacement,
    PlaceFreshnessReport,
    BookingMessage,
  ],
  migrations: ["src/database/migrations/*.ts"],
  synchronize: false,
});
