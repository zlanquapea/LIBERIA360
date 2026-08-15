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
  entities: [Place, Activity, Category, County, User, Review, Business],
  migrations: ["src/database/migrations/*.ts"],
  synchronize: false,
});
