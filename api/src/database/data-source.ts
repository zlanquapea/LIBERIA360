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
import { BusinessContent } from "../business-content/entities/business-content.entity";
import { Creator } from "../creators/entities/creator.entity";
import { CreatorPortfolioItem } from "../creators/entities/creator-portfolio-item.entity";
import { CreatorOffering } from "../creators/entities/creator-offering.entity";
import { CreatorFollow } from "../creators/entities/creator-follow.entity";
import { CreatorPost } from "../creators/entities/creator-post.entity";
import {
  CreatorPostComment,
  CreatorPostLike,
  CreatorPostSave,
} from "../creators/entities/creator-post-interaction.entity";
import { Event } from "../events/entities/event.entity";
import { EventRsvp } from "../events/entities/event-rsvp.entity";
import { Itinerary } from "../itineraries/entities/itinerary.entity";
import { ItineraryCollaborator } from "../itineraries/entities/itinerary-collaborator.entity";
import { TripInvitation } from "../itineraries/entities/trip-invitation.entity";
import { PushSubscription } from "../push/entities/push-subscription.entity";
import { Booking } from "../bookings/entities/booking.entity";
import { AnalyticsEvent } from "../analytics/entities/analytics-event.entity";
import { SponsoredPlacement } from "../sponsored-placements/entities/sponsored-placement.entity";
import { PlaceFreshnessReport } from "../freshness/entities/place-freshness-report.entity";
import { BookingMessage } from "../booking-messages/entities/booking-message.entity";
import { Notification } from "../notifications/entities/notification.entity";
import { Advertisement } from "../advertisements/entities/advertisement.entity";
import { CarListing } from "../car-listings/entities/car-listing.entity";

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
    BusinessContent,
    Creator,
    CreatorPortfolioItem,
    CreatorOffering,
    CreatorFollow,
    CreatorPost,
    CreatorPostLike,
    CreatorPostSave,
    CreatorPostComment,
    Event,
    EventRsvp,
    Itinerary,
    ItineraryCollaborator,
    TripInvitation,
    PushSubscription,
    Booking,
    AnalyticsEvent,
    SponsoredPlacement,
    PlaceFreshnessReport,
    BookingMessage,
    Notification,
    Advertisement,
    CarListing,
  ],
  migrations: ["src/database/migrations/*.ts"],
  synchronize: false,
});
