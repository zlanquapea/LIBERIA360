import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Event } from "./entities/event.entity";
import { EventsService } from "./events.service";
import { EventsController } from "./events.controller";
import { PushModule } from "../push/push.module";
import { UsersModule } from "../users/users.module";
import { BusinessesModule } from "../businesses/businesses.module";
import { CreatorsModule } from "../creators/creators.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Event]),
    PushModule,
    UsersModule,
    BusinessesModule,
    CreatorsModule,
    NotificationsModule,
  ],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
