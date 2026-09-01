import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { TripChatService } from "./trip-chat.service";
import { SendTripMessageDto } from "./dto/send-trip-message.dto";
import { UpdateTripMessageDto } from "./dto/update-trip-message.dto";
import { QueryTripMessagesDto } from "./dto/query-trip-messages.dto";
import { ToggleReactionDto } from "./dto/toggle-reaction.dto";

// Every route here is member-only — a whole separate controller/module
// from ItinerariesController/ItinerariesModule on purpose, see
// TripChatService's class doc for why.
@ApiTags("Trip Chat")
@Controller("itineraries/:itineraryId/chat")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class TripChatController {
  constructor(private readonly chatService: TripChatService) {}

  @Get("messages")
  listMessages(
    @CurrentUser() user: User,
    @Param("itineraryId") itineraryId: string,
    @Query() query: QueryTripMessagesDto,
  ) {
    return this.chatService.listMessages(user.id, itineraryId, query);
  }

  @Post("messages")
  sendMessage(
    @CurrentUser() user: User,
    @Param("itineraryId") itineraryId: string,
    @Body() dto: SendTripMessageDto,
  ) {
    return this.chatService.sendMessage(user.id, itineraryId, dto);
  }

  @Patch("messages/:messageId")
  updateMessage(
    @CurrentUser() user: User,
    @Param("itineraryId") itineraryId: string,
    @Param("messageId") messageId: string,
    @Body() dto: UpdateTripMessageDto,
  ) {
    return this.chatService.updateMessage(user.id, itineraryId, messageId, dto);
  }

  @Delete("messages/:messageId")
  deleteMessage(
    @CurrentUser() user: User,
    @Param("itineraryId") itineraryId: string,
    @Param("messageId") messageId: string,
  ) {
    return this.chatService.deleteMessage(user.id, itineraryId, messageId);
  }

  @Post("messages/:messageId/reactions")
  toggleReaction(
    @CurrentUser() user: User,
    @Param("itineraryId") itineraryId: string,
    @Param("messageId") messageId: string,
    @Body() dto: ToggleReactionDto,
  ) {
    return this.chatService.toggleReaction(
      user.id,
      itineraryId,
      messageId,
      dto.emoji,
    );
  }

  @Post("delivered")
  @HttpCode(HttpStatus.NO_CONTENT)
  markDelivered(
    @CurrentUser() user: User,
    @Param("itineraryId") itineraryId: string,
  ) {
    return this.chatService.markDelivered(user.id, itineraryId);
  }

  @Post("read")
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(
    @CurrentUser() user: User,
    @Param("itineraryId") itineraryId: string,
  ) {
    return this.chatService.markRead(user.id, itineraryId);
  }
}
