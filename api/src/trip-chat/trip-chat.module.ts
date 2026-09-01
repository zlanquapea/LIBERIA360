import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Itinerary } from "../itineraries/entities/itinerary.entity";
import { ItineraryCollaborator } from "../itineraries/entities/itinerary-collaborator.entity";
import { TripMessage } from "./entities/trip-message.entity";
import { TripMessageReaction } from "./entities/trip-message-reaction.entity";
import { TripChatReadState } from "./entities/trip-chat-read-state.entity";
import { TripChatService } from "./trip-chat.service";
import { TripChatController } from "./trip-chat.controller";

// No dependency on ItinerariesModule — see TripChatService's class doc
// for why (ItinerariesModule depends on this one instead, to post
// system messages, and Nest can't have both directions without a
// forwardRef()). Itinerary/ItineraryCollaborator are registered here too
// even though ItinerariesModule already does — perfectly normal in
// TypeORM/Nest for two modules to each get their own injectable
// Repository for the same entity.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Itinerary,
      ItineraryCollaborator,
      TripMessage,
      TripMessageReaction,
      TripChatReadState,
    ]),
  ],
  controllers: [TripChatController],
  providers: [TripChatService],
  exports: [TripChatService],
})
export class TripChatModule {}
