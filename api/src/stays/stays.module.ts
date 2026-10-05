import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Business } from "../businesses/entities/business.entity";
import { NotificationsModule } from "../notifications/notifications.module";
import { SafetyModule } from "../safety/safety.module";
import { ReservationMessage } from "./entities/reservation-message.entity";
import { RoomBlock } from "./entities/room-block.entity";
import { RoomReservation } from "./entities/room-reservation.entity";
import { RoomType } from "./entities/room-type.entity";
import { StaySettings } from "./entities/stay-settings.entity";
import { StaysController } from "./stays.controller";
import { StaysService } from "./stays.service";

export const STAY_ENTITIES = [
  RoomType,
  RoomBlock,
  StaySettings,
  RoomReservation,
  ReservationMessage,
];

@Module({
  imports: [
    TypeOrmModule.forFeature([Business, ...STAY_ENTITIES]),
    NotificationsModule,
    SafetyModule,
  ],
  controllers: [StaysController],
  providers: [StaysService],
  exports: [StaysService],
})
export class StaysModule {}
