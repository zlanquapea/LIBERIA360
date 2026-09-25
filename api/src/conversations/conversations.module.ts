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
import { FoodOrder } from "../food-orders/entities/food-order.entity";
import { BookingMessage } from "../booking-messages/entities/booking-message.entity";
import { FoodOrderMessage } from "../food-order-messages/entities/food-order-message.entity";
import { SupportTicket } from "../support/entities/support-ticket.entity";
import { SupportMessage } from "../support/entities/support-message.entity";
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
      FoodOrder,
      BookingMessage,
      FoodOrderMessage,
      SupportTicket,
      SupportMessage,
    ]),
    NotificationsModule,
    AuthModule,
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService, ConversationsGateway],
  exports: [ConversationsService],
})
export class ConversationsModule {}
