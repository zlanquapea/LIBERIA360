import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NotificationsModule } from "../notifications/notifications.module";
import { Conversation } from "./entities/conversation.entity";
import { ConversationParticipant } from "./entities/conversation-participant.entity";
import { ConversationMessage } from "./entities/conversation-message.entity";
import { GuideProfile } from "../guides/entities/guide-profile.entity";
import { Creator } from "../creators/entities/creator.entity";
import { ConversationsController } from "./conversations.controller";
import { ConversationsService } from "./conversations.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Conversation,
      ConversationParticipant,
      ConversationMessage,
      GuideProfile,
      Creator,
    ]),
    NotificationsModule,
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
