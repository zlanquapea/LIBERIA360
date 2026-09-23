import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuthModule } from "../auth/auth.module";
import { Conversation } from "./entities/conversation.entity";
import { ConversationParticipant } from "./entities/conversation-participant.entity";
import { ConversationMessage } from "./entities/conversation-message.entity";
import { GuideProfile } from "../guides/entities/guide-profile.entity";
import { Creator } from "../creators/entities/creator.entity";
import { Booking } from "../bookings/entities/booking.entity";
import { Itinerary } from "../itineraries/entities/itinerary.entity";
import { ItineraryCollaborator } from "../itineraries/entities/itinerary-collaborator.entity";
import { ConversationsController } from "./conversations.controller";
import { ConversationsService } from "./conversations.service";
import { ConversationsGateway } from "./conversations.gateway";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Conversation,
      ConversationParticipant,
      ConversationMessage,
      GuideProfile,
      Creator,
      Booking,
      Itinerary,
      ItineraryCollaborator,
    ]),
    NotificationsModule,
    AuthModule,
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService, ConversationsGateway],
  exports: [ConversationsService],
})
export class ConversationsModule {}
