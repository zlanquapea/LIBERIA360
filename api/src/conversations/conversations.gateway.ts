import { Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { IncomingMessage } from "http";
import { WebSocketServer, type RawData, type WebSocket } from "ws";
import type { Server as HttpServer } from "http";
import { ConversationsService } from "./conversations.service";
import { SendConversationMessageDto } from "./dto/conversation.dto";

interface ConversationClaims {
  sub: string;
  purpose?: string;
}
interface ConversationSocket extends WebSocket {
  userId?: string;
  conversationId?: string;
}
type ClientEvent =
  | { type: "conversation.message.send"; body: string }
  | { type: "conversation.typing.start" }
  | { type: "conversation.typing.stop" }
  | { type: "conversation.read" };

@Injectable()
export class ConversationsGateway {
  private readonly logger = new Logger(ConversationsGateway.name);
  private readonly socketsByConversation = new Map<
    string,
    Set<ConversationSocket>
  >();
  private wss?: WebSocketServer;

  constructor(
    private readonly jwtService: JwtService,
    private readonly conversations: ConversationsService,
  ) {}

  attach(server: HttpServer) {
    if (this.wss) return;
    this.wss = new WebSocketServer({
      noServer: true,
      maxPayload: 16 * 1024,
      handleProtocols: (protocols) =>
        [...protocols].find((protocol) => protocol.startsWith("bearer.")) ?? "",
    });
    server.on("upgrade", (request, socket, head) => {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (url.pathname !== "/api/v1/conversations/realtime") return;
      this.wss!.handleUpgrade(request, socket, head, (client) => {
        this.wss!.emit("connection", client, request);
      });
    });
    this.wss.on(
      "connection",
      (socket: ConversationSocket, request: IncomingMessage) => {
        void this.handleConnection(socket, request);
      },
    );
  }

  private async handleConnection(
    socket: ConversationSocket,
    request: IncomingMessage,
  ) {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      const conversationId = url.searchParams.get("conversationId");
      const token = this.readToken(request);
      if (!conversationId || !token)
        throw new Error("Missing conversation or authentication token");
      const claims =
        await this.jwtService.verifyAsync<ConversationClaims>(token);
      if (claims.purpose || !claims.sub)
        throw new Error("Invalid authentication token");
      await this.conversations.requireMember(claims.sub, conversationId);
      socket.userId = claims.sub;
      socket.conversationId = conversationId;
      const sockets =
        this.socketsByConversation.get(conversationId) ??
        new Set<ConversationSocket>();
      sockets.add(socket);
      this.socketsByConversation.set(conversationId, sockets);
      socket.on("message", (raw) => void this.handleMessage(socket, raw));
      socket.on("close", () => this.removeSocket(socket));
      socket.on("error", () => this.removeSocket(socket));
      this.send(socket, {
        type: "conversation.ready",
        conversationId,
        userId: claims.sub,
      });
    } catch (error) {
      this.logger.debug(`Rejected conversation connection: ${String(error)}`);
      socket.close(1008, "Authentication failed");
    }
  }

  private async handleMessage(socket: ConversationSocket, raw: RawData) {
    try {
      const event = JSON.parse(raw.toString()) as Partial<ClientEvent>;
      const conversationId = socket.conversationId!;
      const userId = socket.userId!;
      if (
        event.type === "conversation.typing.start" ||
        event.type === "conversation.typing.stop"
      ) {
        this.broadcastExcept(conversationId, socket, {
          type: event.type,
          conversationId,
          userId,
        });
        return;
      }
      if (event.type === "conversation.read") {
        const receipts = await this.conversations.markRead(
          userId,
          conversationId,
        );
        for (const receipt of receipts) {
          this.broadcast(conversationId, {
            type: "conversation.receipt",
            status: "read",
            ...receipt,
          });
        }
        return;
      }
      if (event.type !== "conversation.message.send")
        throw new Error("Unsupported conversation event");
      if (
        typeof event.body !== "string" ||
        event.body.trim().length === 0 ||
        event.body.length > 4000
      ) {
        throw new Error("Message body must be between 1 and 4000 characters");
      }
      const message = await this.conversations.send(userId, conversationId, {
        body: event.body,
      } satisfies SendConversationMessageDto);
      this.broadcast(conversationId, {
        type: "conversation.message.created",
        message,
      });
      await this.markDeliveredForOnlineRecipients(
        conversationId,
        message.id,
        userId,
      );
    } catch (error) {
      this.send(socket, {
        type: "conversation.error",
        message:
          error instanceof Error ? error.message : "Conversation event failed",
      });
    }
  }

  private async markDeliveredForOnlineRecipients(
    conversationId: string,
    messageId: string,
    senderId: string,
  ) {
    const recipients = [
      ...(this.socketsByConversation.get(conversationId) ?? []),
    ].filter(
      (socket) =>
        socket.userId && socket.userId !== senderId && socket.readyState === 1,
    );
    if (!recipients.length) return;
    const receipt = await this.conversations.markDelivered(
      recipients[0].userId!,
      conversationId,
      messageId,
    );
    if (receipt)
      this.broadcast(conversationId, {
        type: "conversation.receipt",
        status: "delivered",
        messageId,
        conversationId,
        deliveredAt: receipt.deliveredAt,
        readAt: receipt.readAt,
      });
  }

  private readToken(request: IncomingMessage) {
    const protocols = String(request.headers["sec-websocket-protocol"] ?? "")
      .split(",")
      .map((item) => item.trim());
    const bearerProtocol = protocols.find((protocol) =>
      protocol.startsWith("bearer."),
    );
    if (bearerProtocol) return bearerProtocol.slice("bearer.".length);
    const cookie = String(request.headers.cookie ?? "")
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith("liberia360_session="));
    if (!cookie) return null;
    try {
      return decodeURIComponent(cookie.slice("liberia360_session=".length));
    } catch {
      return null;
    }
  }

  private broadcast(conversationId: string, payload: unknown) {
    for (const socket of this.socketsByConversation.get(conversationId) ?? [])
      this.send(socket, payload);
  }

  private broadcastExcept(
    conversationId: string,
    excluded: ConversationSocket,
    payload: unknown,
  ) {
    for (const socket of this.socketsByConversation.get(conversationId) ?? []) {
      if (socket !== excluded) this.send(socket, payload);
    }
  }

  private send(socket: ConversationSocket, payload: unknown) {
    if (socket.readyState === 1) socket.send(JSON.stringify(payload));
  }

  private removeSocket(socket: ConversationSocket) {
    if (!socket.conversationId) return;
    const sockets = this.socketsByConversation.get(socket.conversationId);
    sockets?.delete(socket);
    if (sockets?.size === 0)
      this.socketsByConversation.delete(socket.conversationId);
  }
}
