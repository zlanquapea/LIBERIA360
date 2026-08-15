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
          entities: [Place, Activity, Category, County],
          migrations: ["dist/database/migrations/*.js"],
          autoLoadEntities: true,
        };
      },
    }),
    HealthModule,
    PlacesModule,
    CountiesModule,
    CategoriesModule,
  ],
})
export class AppModule {}
