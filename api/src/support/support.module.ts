import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NotificationsModule } from "../notifications/notifications.module";
import { User } from "../users/entities/user.entity";
import { SupportMessage } from "./entities/support-message.entity";
import { SupportTicket } from "./entities/support-ticket.entity";
import {
  AdminSupportController,
  SupportController,
} from "./support.controller";
import { SupportService } from "./support.service";
@Module({
  imports: [
    TypeOrmModule.forFeature([SupportTicket, SupportMessage, User]),
    NotificationsModule,
  ],
  controllers: [SupportController, AdminSupportController],
  providers: [SupportService],
})
export class SupportModule {}
