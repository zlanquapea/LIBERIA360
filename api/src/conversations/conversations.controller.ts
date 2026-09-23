import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { ConversationsService } from "./conversations.service";
import {
  CreateConversationDto,
  SendConversationMessageDto,
  ToggleConversationReactionDto,
  UpdateConversationMessageDto,
} from "./dto/conversation.dto";

@ApiTags("Conversations")
@Controller("conversations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}
  @Get() list(@CurrentUser() user: User) {
    return this.conversations.list(user.id);
  }
  @Post() create(
    @CurrentUser() user: User,
    @Body() dto: CreateConversationDto,
  ) {
    return this.conversations.createDirect(user.id, dto);
  }
  @Post("guide/:guideId") createForGuide(
    @CurrentUser() user: User,
    @Param("guideId") guideId: string,
  ) {
    return this.conversations.createForGuide(user.id, guideId);
  }
  @Post("creator/:creatorId") createForCreator(
    @CurrentUser() user: User,
    @Param("creatorId") creatorId: string,
  ) {
    return this.conversations.createForCreator(user.id, creatorId);
  }
  @Get(":id") get(@CurrentUser() user: User, @Param("id") id: string) {
    return this.conversations.get(user.id, id);
  }
  @Get(":id/messages") messages(
    @CurrentUser() user: User,
    @Param("id") id: string,
  ) {
    return this.conversations.messages(user.id, id);
  }
  @Post(":id/messages") send(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: SendConversationMessageDto,
  ) {
    return this.conversations.send(user.id, id, dto);
  }
  @Post(":id/read") read(@CurrentUser() user: User, @Param("id") id: string) {
    return this.conversations.markRead(user.id, id);
  }
  @Patch("messages/:messageId") update(
    @CurrentUser() user: User,
    @Param("messageId") messageId: string,
    @Body() dto: UpdateConversationMessageDto,
  ) {
    return this.conversations.updateMessage(user.id, messageId, dto);
  }
  @Delete("messages/:messageId") delete(
    @CurrentUser() user: User,
    @Param("messageId") messageId: string,
  ) {
    return this.conversations.deleteMessage(user.id, messageId);
  }
  @Post("messages/:messageId/reactions") react(
    @CurrentUser() user: User,
    @Param("messageId") messageId: string,
    @Body() dto: ToggleConversationReactionDto,
  ) {
    return this.conversations.react(user.id, messageId, dto);
  }
}
