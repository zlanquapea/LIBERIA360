import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Advertisement } from "./entities/advertisement.entity";
import { AdvertisementsService } from "./advertisements.service";
import { AdvertisementsController } from "./advertisements.controller";
import { NotificationsModule } from "../notifications/notifications.module";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Advertisement]),
    NotificationsModule,
    UsersModule,
  ],
  controllers: [AdvertisementsController],
  providers: [AdvertisementsService],
  exports: [AdvertisementsService],
})
export class AdvertisementsModule {}
