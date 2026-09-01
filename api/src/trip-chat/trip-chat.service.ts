import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { Itinerary } from "../itineraries/entities/itinerary.entity";
import { ItineraryCollaborator } from "../itineraries/entities/itinerary-collaborator.entity";
import { TripMessage } from "./entities/trip-message.entity";
import { TripMessageType } from "./entities/trip-message.enums";
import { TripMessageReaction } from "./entities/trip-message-reaction.entity";
import { TripChatReadState } from "./entities/trip-chat-read-state.entity";
import { SendTripMessageDto } from "./dto/send-trip-message.dto";
import { UpdateTripMessageDto } from "./dto/update-trip-message.dto";
import { QueryTripMessagesDto } from "./dto/query-trip-messages.dto";
import { PublicUser, toPublicUser } from "../users/user.serializer";

export type TripMessageDeliveryStatus = "sent" | "delivered" | "read";

export interface TripMessageReactionSummary {
  emoji: string;
  count: number;
  userIds: string[];
}

export interface TripMessageReplyPreview {
  id: string;
  senderName: string | null;
  body: string | null;
  imageUrl: string | null;
  deleted: boolean;
}

export interface TripMessageSummary {
  id: string;
  itineraryId: string;
  type: TripMessageType;
  sender: PublicUser | null;
  body: string | null;
  imageUrl: string | null;
  clientId: string | null;
  replyTo: TripMessageReplyPreview | null;
  reactions: TripMessageReactionSummary[];
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  status: TripMessageDeliveryStatus;
}

/**
 * Trip group chat (Sections 9-12 of the Aug 2026 social-trip spec). This
 * module deliberately has NO dependency on ItinerariesModule — it keeps
 * its own minimal member check straight off the Itinerary/
 * ItineraryCollaborator tables (the same boundary
 * `ItinerariesService.assertCanView` enforces) so that ItinerariesModule
 * can depend on *this* module instead (to call postSystemMessage — see
 * that method) without the two modules needing each other, which Nest
 * can't wire up without an explicit forwardRef(). One-directional beats
 * that, and the duplicated membership check is a handful of lines.
 *
 * No websocket/push infra exists in this app yet (see BookingMessageThread's
 * doc comment) — "real-time" here means the same light poll every other
 * in-platform message thread already uses, just on a shorter interval
 * given a live group conversation is a more active surface than a single
 * booking's back-and-forth.
 */
@Injectable()
export class TripChatService {
  // A small, fixed set — the frontend only ever offers these, and the
  // server enforces the same list so a direct API call can't post
  // arbitrary text through the reaction endpoint.
  private static readonly ALLOWED_REACTIONS = [
    "👍",
    "❤️",
    "😂",
    "😮",
    "😢",
    "🙏",
    "🎉",
  ];

  constructor(
    @InjectRepository(Itinerary)
    private readonly itineraryRepo: Repository<Itinerary>,
    @InjectRepository(ItineraryCollaborator)
    private readonly collaboratorRepo: Repository<ItineraryCollaborator>,
    @InjectRepository(TripMessage)
    private readonly messageRepo: Repository<TripMessage>,
    @InjectRepository(TripMessageReaction)
    private readonly reactionRepo: Repository<TripMessageReaction>,
    @InjectRepository(TripChatReadState)
    private readonly readStateRepo: Repository<TripChatReadState>,
  ) {}

  /** Newest-`limit` messages in chronological order, or the `limit`
   * messages strictly before `before` for loading older history. Member
   * only — 404s a non-member exactly like every other member-only trip
   * route, including a genuinely nonexistent trip. */
  async listMessages(
    userId: string,
    itineraryId: string,
    query: QueryTripMessagesDto,
  ): Promise<TripMessageSummary[]> {
    const { memberIds } = await this.assertMember(userId, itineraryId);
    const qb = this.messageRepo
      .createQueryBuilder("message")
      .leftJoinAndSelect("message.sender", "sender")
      .where("message.itineraryId = :itineraryId", { itineraryId });
    if (query.before) {
      qb.andWhere("message.createdAt < :before", {
        before: new Date(query.before),
      });
    }
    qb.orderBy("message.createdAt", "DESC").take(query.limit ?? 50);
    const rows = await qb.getMany();
    rows.reverse();
    return this.toSummaries(itineraryId, memberIds, rows);
  }

  /**
   * A text and/or image message, optionally quoting an earlier one.
   *
   * Deliberately does not write a `NotificationsService` row, unlike every
   * other trip-social action (invitations, join requests, cancellation).
   * A live-visible group conversation is a different kind of surface than
   * an async notification — the same distinction real chat apps draw
   * between "message delivered to an open thread" and "you have a
   * notification" — so sending a chat message doesn't also ping everyone
   * else's notification bell.
   */
  async sendMessage(
    userId: string,
    itineraryId: string,
    dto: SendTripMessageDto,
  ): Promise<TripMessageSummary> {
    const { memberIds } = await this.assertMember(userId, itineraryId);
    const body = dto.body?.trim() || undefined;
    if (!body && !dto.imageUrl) {
      throw new BadRequestException("A message needs text or an image");
    }
    if (dto.replyToMessageId) {
      const parent = await this.messageRepo.findOne({
        where: { id: dto.replyToMessageId, itineraryId },
      });
      if (!parent) {
        throw new NotFoundException(
          "The message you're replying to could not be found",
        );
      }
    }
    const saved = await this.messageRepo.save(
      this.messageRepo.create({
        itineraryId,
        senderUserId: userId,
        type: TripMessageType.USER,
        body: body ?? null,
        imageUrl: dto.imageUrl ?? null,
        replyToMessageId: dto.replyToMessageId ?? null,
        clientId: dto.clientId ?? null,
      }),
    );
    // Sending obviously means you've seen everything up to now yourself.
    await this.markRead(userId, itineraryId);
    const full = await this.messageRepo.findOneOrFail({
      where: { id: saved.id },
    });
    const [summary] = await this.toSummaries(itineraryId, memberIds, [full]);
    return summary;
  }

  /** Sender-only, text messages only — see UpdateTripMessageDto's doc
   * comment for why an image-only message can't go through here. */
  async updateMessage(
    userId: string,
    itineraryId: string,
    messageId: string,
    dto: UpdateTripMessageDto,
  ): Promise<TripMessageSummary> {
    const { memberIds } = await this.assertMember(userId, itineraryId);
    const message = await this.getOwnMessage(userId, itineraryId, messageId);
    if (message.deletedAt) {
      throw new ConflictException("This message was deleted");
    }
    if (!message.body && message.imageUrl) {
      throw new BadRequestException(
        "An image-only message can't be edited — delete and resend instead",
      );
    }
    message.body = dto.body.trim();
    message.editedAt = new Date();
    await this.messageRepo.save(message);
    const [summary] = await this.toSummaries(itineraryId, memberIds, [message]);
    return summary;
  }

  /** Sender-only soft delete — same "row stays, API redacts it" pattern
   * as BookingMessage.deletedAt. Idempotent: deleting an already-deleted
   * message just returns it as-is rather than erroring. */
  async deleteMessage(
    userId: string,
    itineraryId: string,
    messageId: string,
  ): Promise<TripMessageSummary> {
    const { memberIds } = await this.assertMember(userId, itineraryId);
    const message = await this.getOwnMessage(userId, itineraryId, messageId);
    if (!message.deletedAt) {
      message.deletedAt = new Date();
      await this.messageRepo.save(message);
    }
    const [summary] = await this.toSummaries(itineraryId, memberIds, [message]);
    return summary;
  }

  /** Any member can react to any message, including their own. Reacting
   * again with the same emoji removes it — a toggle, not an add-only
   * button, matching the reaction UI every chat app uses. */
  async toggleReaction(
    userId: string,
    itineraryId: string,
    messageId: string,
    emoji: string,
  ): Promise<TripMessageSummary> {
    const { memberIds } = await this.assertMember(userId, itineraryId);
    if (!TripChatService.ALLOWED_REACTIONS.includes(emoji)) {
      throw new BadRequestException("That reaction isn't supported");
    }
    const message = await this.messageRepo.findOne({
      where: { id: messageId, itineraryId },
    });
    if (!message) {
      throw new NotFoundException("Message not found");
    }
    const existing = await this.reactionRepo.findOne({
      where: { messageId, userId, emoji },
    });
    if (existing) {
      await this.reactionRepo.delete({ id: existing.id });
    } else {
      await this.reactionRepo.save(
        this.reactionRepo.create({ messageId, userId, emoji }),
      );
    }
    const [summary] = await this.toSummaries(itineraryId, memberIds, [message]);
    return summary;
  }

  /** The client calls this once a poll's response has actually arrived —
   * "Delivered" reflects the thread having actually reached this
   * member's device, not just that the server accepted it. */
  async markDelivered(userId: string, itineraryId: string): Promise<void> {
    await this.assertMember(userId, itineraryId);
    await this.advanceReadState(itineraryId, userId, "lastDeliveredAt");
  }

  /** The client calls this while the thread is open and visible —
   * "Read" reflects this member having actually had it in front of them,
   * not merely fetched it. Implies delivered too. */
  async markRead(userId: string, itineraryId: string): Promise<void> {
    await this.assertMember(userId, itineraryId);
    await this.advanceReadState(itineraryId, userId, "lastReadAt");
    await this.advanceReadState(itineraryId, userId, "lastDeliveredAt");
  }

  /** Internal only — never exposed over HTTP. Called by
   * ItinerariesService after a join/leave/rename/cancel so the group
   * conversation itself carries a record of what happened (Section 9's
   * "system messages for joins/leaves/updates"), the same way a Slack
   * channel announces a membership change inline instead of only
   * somewhere else in the product. */
  async postSystemMessage(itineraryId: string, body: string): Promise<void> {
    await this.messageRepo.save(
      this.messageRepo.create({
        itineraryId,
        type: TripMessageType.SYSTEM,
        senderUserId: null,
        body,
      }),
    );
  }

  private async getOwnMessage(
    userId: string,
    itineraryId: string,
    messageId: string,
  ): Promise<TripMessage> {
    const message = await this.messageRepo.findOne({
      where: { id: messageId, itineraryId },
    });
    if (!message) {
      throw new NotFoundException("Message not found");
    }
    if (message.type === TripMessageType.SYSTEM) {
      throw new ForbiddenException("System messages can't be edited");
    }
    if (message.senderUserId !== userId) {
      throw new ForbiddenException(
        "You can only edit or delete your own messages",
      );
    }
    return message;
  }

  private async advanceReadState(
    itineraryId: string,
    userId: string,
    field: "lastDeliveredAt" | "lastReadAt",
  ): Promise<void> {
    let state = await this.readStateRepo.findOne({
      where: { itineraryId, userId },
    });
    const now = new Date();
    if (!state) {
      state = this.readStateRepo.create({ itineraryId, userId });
    }
    const current = state[field];
    if (!current || current.getTime() < now.getTime()) {
      state[field] = now;
      await this.readStateRepo.save(state);
    }
  }

  /** Owner or collaborator — the same boundary as everywhere else in the
   * trip; 404s a non-member (or a genuinely nonexistent trip) rather
   * than confirming either exists. */
  private async assertMember(
    userId: string,
    itineraryId: string,
  ): Promise<{ itinerary: Itinerary; memberIds: string[] }> {
    const itinerary = await this.itineraryRepo.findOne({
      where: { id: itineraryId },
    });
    if (!itinerary) {
      throw new NotFoundException(`Trip "${itineraryId}" not found`);
    }
    const collaborators = await this.collaboratorRepo.find({
      where: { itineraryId },
      select: ["userId"],
    });
    const memberIds = [itinerary.userId, ...collaborators.map((c) => c.userId)];
    if (!memberIds.includes(userId)) {
      throw new NotFoundException(`Trip "${itineraryId}" not found`);
    }
    return { itinerary, memberIds };
  }

  private async toSummaries(
    itineraryId: string,
    memberIds: string[],
    messages: TripMessage[],
  ): Promise<TripMessageSummary[]> {
    if (messages.length === 0) return [];
    const ids = messages.map((m) => m.id);
    const replyIds = [
      ...new Set(
        messages
          .map((m) => m.replyToMessageId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const [replyRows, reactionRows, readStates] = await Promise.all([
      replyIds.length
        ? this.messageRepo.find({ where: { id: In(replyIds) } })
        : Promise.resolve([]),
      this.reactionRepo.find({ where: { messageId: In(ids) } }),
      memberIds.length
        ? this.readStateRepo.find({
            where: { itineraryId, userId: In(memberIds) },
          })
        : Promise.resolve([]),
    ]);
    const replyById = new Map(replyRows.map((r) => [r.id, r]));
    const reactionsByMessage = new Map<string, TripMessageReaction[]>();
    for (const reaction of reactionRows) {
      const list = reactionsByMessage.get(reaction.messageId) ?? [];
      list.push(reaction);
      reactionsByMessage.set(reaction.messageId, list);
    }
    const readStateByUser = new Map(readStates.map((s) => [s.userId, s]));

    return messages.map((message) =>
      this.toSummary(
        message,
        memberIds,
        replyById,
        reactionsByMessage.get(message.id) ?? [],
        readStateByUser,
      ),
    );
  }

  private toSummary(
    message: TripMessage,
    memberIds: string[],
    replyById: Map<string, TripMessage>,
    reactions: TripMessageReaction[],
    readStateByUser: Map<string, TripChatReadState>,
  ): TripMessageSummary {
    const deleted = Boolean(message.deletedAt);
    const parent = message.replyToMessageId
      ? (replyById.get(message.replyToMessageId) ?? null)
      : null;
    return {
      id: message.id,
      itineraryId: message.itineraryId,
      type: message.type,
      sender: message.sender ? toPublicUser(message.sender) : null,
      body: deleted ? null : message.body,
      imageUrl: deleted ? null : message.imageUrl,
      clientId: message.clientId,
      replyTo: parent
        ? {
            id: parent.id,
            senderName: parent.sender?.name ?? null,
            body: parent.deletedAt ? null : parent.body,
            imageUrl: parent.deletedAt ? null : parent.imageUrl,
            deleted: Boolean(parent.deletedAt),
          }
        : null,
      reactions: deleted ? [] : this.summarizeReactions(reactions),
      createdAt: message.createdAt,
      editedAt: message.editedAt,
      deletedAt: message.deletedAt,
      status: this.computeStatus(message, memberIds, readStateByUser),
    };
  }

  private summarizeReactions(
    reactions: TripMessageReaction[],
  ): TripMessageReactionSummary[] {
    const byEmoji = new Map<string, string[]>();
    for (const reaction of reactions) {
      const list = byEmoji.get(reaction.emoji) ?? [];
      list.push(reaction.userId);
      byEmoji.set(reaction.emoji, list);
    }
    return [...byEmoji.entries()].map(([emoji, userIds]) => ({
      emoji,
      count: userIds.length,
      userIds,
    }));
  }

  private computeStatus(
    message: TripMessage,
    memberIds: string[],
    readStateByUser: Map<string, TripChatReadState>,
  ): TripMessageDeliveryStatus {
    const others = memberIds.filter((id) => id !== message.senderUserId);
    if (others.length === 0) return "sent";
    const createdAt = message.createdAt.getTime();
    const pastCreatedAt = (at: Date | null | undefined) =>
      (at?.getTime() ?? 0) >= createdAt;
    if (
      others.every((id) => pastCreatedAt(readStateByUser.get(id)?.lastReadAt))
    ) {
      return "read";
    }
    if (
      others.every((id) =>
        pastCreatedAt(readStateByUser.get(id)?.lastDeliveredAt),
      )
    ) {
      return "delivered";
    }
    return "sent";
  }
}
