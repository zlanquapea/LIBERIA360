import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Creator } from "../creators/entities/creator.entity";
import { Place } from "../places/entities/place.entity";
import { Itinerary } from "../itineraries/entities/itinerary.entity";
import { NotificationsModule } from "../notifications/notifications.module";
import { UsersModule } from "../users/users.module";
import { CreatorGuide } from "./entities/creator-guide.entity";
import { SavedGuide } from "./entities/saved-guide.entity";
import { CreatorGuidesService } from "./creator-guides.service";
import {
  AdminCreatorGuidesController,
  CreatorGuidesController,
} from "./creator-guides.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CreatorGuide,
      SavedGuide,
      Creator,
      Place,
      Itinerary,
    ]),
    NotificationsModule,
    UsersModule,
  ],
  controllers: [CreatorGuidesController, AdminCreatorGuidesController],
  providers: [CreatorGuidesService],
})
export class CreatorGuidesModule {}
