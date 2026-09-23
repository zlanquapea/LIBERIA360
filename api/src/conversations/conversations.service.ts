import {
  ForbiddenException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { NotificationsService } from "../notifications/notifications.service";
import { GuideProfile } from "../guides/entities/guide-profile.entity";
import { Creator } from "../creators/entities/creator.entity";
import { Conversation } from "./entities/conversation.entity";
import { ConversationParticipant } from "./entities/conversation-participant.entity";
import { ConversationMessage } from "./entities/conversation-message.entity";
import {
  CreateConversationDto,
  SendConversationMessageDto,
  ToggleConversationReactionDto,
  UpdateConversationMessageDto,
} from "./dto/conversation.dto";

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(ConversationParticipant)
    private readonly participantRepo: Repository<ConversationParticipant>,
    @InjectRepository(ConversationMessage)
    private readonly messageRepo: Repository<ConversationMessage>,
    @InjectRepository(GuideProfile)
    private readonly guideRepo: Repository<GuideProfile>,
    @InjectRepository(Creator)
    private readonly creatorRepo: Repository<Creator>,
    private readonly notifications: NotificationsService,
  ) {}

  async list(userId: string) {
    const memberships = await this.participantRepo.find({
      where: { userId, archived: false },
      relations: { conversation: true },
      order: { createdAt: "DESC" },
    });
    const result = [];
    for (const membership of memberships) {
      const participants = await this.participantRepo.find({
        where: { conversationId: membership.conversationId },
      });
      const last = await this.messageRepo.findOne({
        where: { conversationId: membership.conversationId },
        order: { createdAt: "DESC" },
      });
      const unread = await this.messageRepo.count({
        where: { conversationId: membership.conversationId, readAt: IsNull() },
      });
      result.push(
        this.publicConversation(
          userId,
          membership.conversation,
          participants,
          last,
          unread,
        ),
      );
    }
    return result.sort(
      (a, b) =>
        new Date(b.lastMessage?.createdAt ?? b.createdAt).getTime() -
        new Date(a.lastMessage?.createdAt ?? a.createdAt).getTime(),
    );
  }

  async createDirect(userId: string, dto: CreateConversationDto) {
    if (userId === dto.participantId)
      throw new ForbiddenException("You cannot message yourself");
    const existing = await this.findDirect(
      userId,
      dto.participantId,
      dto.contextType,
      dto.contextId,
    );
    if (existing) return this.get(userId, existing.id);
    const conversation = await this.conversationRepo.save(
      this.conversationRepo.create({
        contextType: dto.contextType ?? "direct",
        contextId: dto.contextId ?? null,
        title: dto.title ?? null,
        avatarUrl: dto.avatarUrl ?? null,
        lastMessageAt: null,
      }),
    );
    await this.participantRepo.save([
      this.participantRepo.create({ conversationId: conversation.id, userId }),
      this.participantRepo.create({
        conversationId: conversation.id,
        userId: dto.participantId,
      }),
    ]);
    return this.get(userId, conversation.id);
  }

  async createForGuide(userId: string, guideId: string) {
    const guide = await this.guideRepo.findOne({ where: { id: guideId } });
    if (!guide) throw new NotFoundException("Guide profile not found");
    return this.createDirect(userId, {
      participantId: guide.userId,
      contextType: "guide",
      contextId: guide.id,
      title: guide.slug.replaceAll("-", " "),
      avatarUrl: guide.profileImageUrl ?? undefined,
    });
  }

  async createForCreator(userId: string, creatorId: string) {
    const creator = await this.creatorRepo.findOne({
      where: { id: creatorId },
    });
    if (!creator) throw new NotFoundException("Creator profile not found");
    return this.createDirect(userId, {
      participantId: creator.userId,
      contextType: "creator",
      contextId: creator.id,
      title: creator.name,
      avatarUrl: creator.profileImage ?? undefined,
    });
  }

  async get(userId: string, conversationId: string) {
    const membership = await this.participantRepo.findOne({
      where: { conversationId, userId },
      relations: { conversation: true },
    });
    if (!membership)
      throw new ForbiddenException("You are not part of this conversation");
    const participants = await this.participantRepo.find({
      where: { conversationId },
    });
    const last = await this.messageRepo.findOne({
      where: { conversationId },
      order: { createdAt: "DESC" },
    });
    const unread = await this.messageRepo.count({
      where: { conversationId, readAt: IsNull() },
    });
    return this.publicConversation(
      userId,
      membership.conversation,
      participants,
      last,
      unread,
    );
  }

  async messages(userId: string, conversationId: string) {
    await this.requireMember(userId, conversationId);
    const messages = await this.messageRepo.find({
      where: { conversationId },
      order: { createdAt: "ASC" },
    });
    await this.markRead(userId, conversationId);
    return messages.map((message) => this.publicMessage(message));
  }

  async send(
    userId: string,
    conversationId: string,
    dto: SendConversationMessageDto,
  ) {
    const membership = await this.requireMember(userId, conversationId);
    const body = dto.body?.trim() ?? "";
    const attachments = dto.attachments ?? [];
    if (!body && attachments.length === 0) {
      throw new BadRequestException("A message needs text or an attachment");
    }
    if (attachments.length > 10) {
      throw new BadRequestException(
        "A message can include up to 10 attachments",
      );
    }
    if (
      dto.messageType &&
      !["text", "image", "file", "voice", "location"].includes(dto.messageType)
    ) {
      throw new BadRequestException("Unsupported message type");
    }
    for (const attachment of attachments) {
      if (
        typeof attachment.url !== "string" ||
        attachment.url.length === 0 ||
        attachment.url.length > 2000
      ) {
        throw new BadRequestException("Every attachment needs a valid URL");
      }
      if (
        attachment.kind !== undefined &&
        !["image", "video", "audio", "file"].includes(String(attachment.kind))
      ) {
        throw new BadRequestException("Unsupported attachment type");
      }
    }
    const message = await this.messageRepo.save(
      this.messageRepo.create({
        conversationId,
        senderId: userId,
        body,
        messageType: dto.messageType ?? "text",
        attachments,
        reactions: {},
        deliveredAt: null,
        readAt: null,
        editedAt: null,
        deletedAt: null,
      }),
    );
    await this.conversationRepo.update(conversationId, {
      lastMessageAt: message.createdAt,
    });
    const participants = await this.participantRepo.find({
      where: { conversationId },
    });
    const recipientIds = participants
      .filter((item) => item.userId !== userId)
      .map((item) => item.userId);
    if (recipientIds.length)
      await this.notifications.createMany(recipientIds, {
        type: "guide.message",
        title: "New message",
        body: body.slice(0, 120) || "Sent an attachment",
        link: `/messages/${encodeURIComponent(conversationId)}`,
      });
    void membership;
    return this.publicMessage(message);
  }

  async markDelivered(
    userId: string,
    conversationId: string,
    messageId: string,
  ) {
    await this.requireMember(userId, conversationId);
    const message = await this.messageRepo.findOne({
      where: { id: messageId, conversationId },
    });
    if (!message || message.senderId === userId) return null;
    if (!message.deliveredAt) {
      message.deliveredAt = new Date();
      await this.messageRepo.save(message);
    }
    return this.publicMessage(message);
  }

  async markRead(userId: string, conversationId: string) {
    const membership = await this.requireMember(userId, conversationId);
    const unread = await this.messageRepo.find({
      where: { conversationId, readAt: IsNull() },
    });
    const received = unread.filter((message) => message.senderId !== userId);
    const readAt = new Date();
    await this.messageRepo
      .createQueryBuilder()
      .update(ConversationMessage)
      .set({ readAt, deliveredAt: readAt })
      .where("conversation_id = :conversationId", { conversationId })
      .andWhere("sender_id != :userId", { userId })
      .andWhere("read_at IS NULL")
      .execute();
    membership.lastReadAt = new Date();
    await this.participantRepo.save(membership);
    return received.map((message) => ({
      messageId: message.id,
      conversationId,
      deliveredAt: readAt,
      readAt,
    }));
  }

  async updateMessage(
    userId: string,
    messageId: string,
    dto: UpdateConversationMessageDto,
  ) {
    const message = await this.messageRepo.findOne({
      where: { id: messageId },
    });
    if (!message) throw new NotFoundException("Message not found");
    await this.requireMember(userId, message.conversationId);
    if (message.senderId !== userId)
      throw new ForbiddenException("You can only edit your own messages");
    if (message.deletedAt)
      throw new ForbiddenException("Deleted messages cannot be edited");
    message.body = dto.body.trim();
    message.editedAt = new Date();
    return this.publicMessage(await this.messageRepo.save(message));
  }

  async deleteMessage(userId: string, messageId: string) {
    const message = await this.messageRepo.findOne({
      where: { id: messageId },
    });
    if (!message) throw new NotFoundException("Message not found");
    await this.requireMember(userId, message.conversationId);
    if (message.senderId !== userId)
      throw new ForbiddenException("You can only delete your own messages");
    message.body = "This message was deleted";
    message.deletedAt = new Date();
    message.attachments = [];
    return this.publicMessage(await this.messageRepo.save(message));
  }

  async react(
    userId: string,
    messageId: string,
    dto: ToggleConversationReactionDto,
  ) {
    const message = await this.messageRepo.findOne({
      where: { id: messageId },
    });
    if (!message) throw new NotFoundException("Message not found");
    await this.requireMember(userId, message.conversationId);
    const reactions = message.reactions ?? {};
    const users = new Set(reactions[dto.emoji] ?? []);
    if (users.has(userId)) {
      users.delete(userId);
    } else {
      users.add(userId);
    }
    reactions[dto.emoji] = [...users];
    message.reactions = reactions;
    return this.publicMessage(await this.messageRepo.save(message));
  }

  private async findDirect(
    userId: string,
    participantId: string,
    contextType?: string,
    contextId?: string,
  ) {
    const mine = await this.participantRepo.find({ where: { userId } });
    for (const membership of mine) {
      const conversation = await this.conversationRepo.findOne({
        where: {
          id: membership.conversationId,
          contextType: contextType ?? "direct",
          ...(contextId ? { contextId } : { contextId: IsNull() }),
        },
      });
      if (!conversation) continue;
      if (
        await this.participantRepo.exists({
          where: { conversationId: conversation.id, userId: participantId },
        })
      )
        return conversation;
    }
    return null;
  }

  async requireMember(userId: string, conversationId: string) {
    const membership = await this.participantRepo.findOne({
      where: { conversationId, userId },
    });
    if (!membership)
      throw new ForbiddenException("You are not part of this conversation");
    return membership;
  }

  private publicConversation(
    viewerId: string,
    conversation: Conversation,
    participants: ConversationParticipant[],
    lastMessage: ConversationMessage | null,
    unread: number,
  ) {
    const participantList = participants.map((item) => ({
      id: item.userId,
      name: item.user?.name ?? "Member",
      profileImage: item.user?.profileImage ?? null,
      role: item.role,
    }));
    return {
      id: conversation.id,
      contextType: conversation.contextType,
      contextId: conversation.contextId,
      title: conversation.title,
      avatarUrl: conversation.avatarUrl,
      createdAt: conversation.createdAt,
      lastMessage,
      unreadCount: unread,
      participants: participantList,
      otherParticipant:
        participantList.find((participant) => participant.id !== viewerId) ??
        null,
    };
  }
  private publicMessage(message: ConversationMessage) {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      sender: message.sender
        ? {
            id: message.sender.id,
            name: message.sender.name,
            profileImage: message.sender.profileImage ?? null,
          }
        : null,
      body: message.body,
      messageType: message.messageType,
      attachments: message.attachments,
      reactions: message.reactions,
      deliveredAt: message.deliveredAt,
      readAt: message.readAt,
      editedAt: message.editedAt,
      deletedAt: message.deletedAt,
      createdAt: message.createdAt,
    };
  }
}
