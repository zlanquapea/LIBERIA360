import { Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { IncomingMessage } from "http";
import { WebSocketServer, type RawData, type WebSocket } from "ws";
import type { Server as HttpServer } from "http";
import { GuidesService } from "./guides.service";
import { SendGuideMessageDto } from "./dto/guide-message.dto";

interface GuideChatClaims {
  sub: string;
  tokenVersion?: number;
  purpose?: string;
}

interface GuideChatSocket extends WebSocket {
  userId?: string;
  guideId?: string;
  visitorId?: string;
}

interface GuideChatSendEvent {
  type: "guide.message.send";
  guideId: string;
  body: string;
  visitorId?: string;
}

@Injectable()
export class GuideChatGateway {
  private readonly logger = new Logger(GuideChatGateway.name);
  private readonly socketsByConversation = new Map<
    string,
    Set<GuideChatSocket>
  >();
  private wss?: WebSocketServer;

  constructor(
    private readonly jwtService: JwtService,
    private readonly guidesService: GuidesService,
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
      if (url.pathname !== "/api/v1/guides/chat") return;
      this.wss!.handleUpgrade(request, socket, head, (client) => {
        this.wss!.emit("connection", client, request);
      });
    });
    this.wss.on(
      "connection",
      (socket: GuideChatSocket, request: IncomingMessage) => {
        void this.handleConnection(socket, request);
      },
    );
  }

  private async handleConnection(
    socket: GuideChatSocket,
    request: IncomingMessage,
  ) {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      const guideId = url.searchParams.get("guideId");
      const token = this.readToken(request);
      if (!guideId || !token)
        throw new Error("Missing guide or authentication token");
      const claims = await this.jwtService.verifyAsync<GuideChatClaims>(token);
      if (claims.purpose || !claims.sub)
        throw new Error("Invalid authentication token");
      const ownerId = await this.guidesService.getGuideOwnerId(guideId);
      const visitorId = claims.sub === ownerId ? undefined : claims.sub;
      socket.userId = claims.sub;
      socket.guideId = guideId;
      socket.visitorId = visitorId;
      const key = this.conversationKey(guideId, visitorId ?? "*");
      const sockets =
        this.socketsByConversation.get(key) ?? new Set<GuideChatSocket>();
      sockets.add(socket);
      this.socketsByConversation.set(key, sockets);
      socket.on("message", (raw) => void this.handleMessage(socket, raw));
      socket.on("close", () => this.removeSocket(socket));
      socket.on("error", () => this.removeSocket(socket));
      this.send(socket, {
        type: "guide.chat.ready",
        guideId,
        userId: claims.sub,
      });
    } catch (error) {
      this.logger.debug(`Rejected guide chat connection: ${String(error)}`);
      socket.close(1008, "Authentication failed");
    }
  }

  private async handleMessage(socket: GuideChatSocket, raw: RawData) {
    try {
      const event = JSON.parse(raw.toString()) as Partial<GuideChatSendEvent>;
      if (
        event.type !== "guide.message.send" ||
        event.guideId !== socket.guideId
      ) {
        throw new Error("Unsupported guide chat event");
      }
      if (
        typeof event.body !== "string" ||
        event.body.trim().length === 0 ||
        event.body.length > 4000
      ) {
        throw new Error("Message body must be between 1 and 4000 characters");
      }
      const message = await this.guidesService.sendGuideMessage(
        socket.userId!,
        socket.guideId!,
        {
          body: event.body,
          visitorId: event.visitorId,
        } satisfies SendGuideMessageDto,
      );
      const visitorId = message.visitorId;
      this.broadcast(socket.guideId!, visitorId, {
        type: "guide.message.created",
        message,
      });
    } catch (error) {
      this.send(socket, {
        type: "guide.chat.error",
        message:
          error instanceof Error ? error.message : "Message could not be sent",
      });
    }
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

  private broadcast(guideId: string, visitorId: string, payload: unknown) {
    const targets = [
      this.socketsByConversation.get(this.conversationKey(guideId, visitorId)),
      this.socketsByConversation.get(this.conversationKey(guideId, "*")),
    ];
    const delivered = new Set<GuideChatSocket>();
    for (const sockets of targets) {
      for (const socket of sockets ?? []) {
        if (delivered.has(socket) || socket.readyState !== 1) continue;
        delivered.add(socket);
        this.send(socket, payload);
      }
    }
  }

  private send(socket: GuideChatSocket, payload: unknown) {
    if (socket.readyState === 1) socket.send(JSON.stringify(payload));
  }

  private removeSocket(socket: GuideChatSocket) {
    if (!socket.guideId) return;
    const key = this.conversationKey(socket.guideId, socket.visitorId ?? "*");
    const sockets = this.socketsByConversation.get(key);
    sockets?.delete(socket);
    if (sockets?.size === 0) this.socketsByConversation.delete(key);
  }

  private conversationKey(guideId: string, visitorId: string) {
    return `${guideId}:${visitorId}`;
  }
}
