import { ForbiddenException, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SafetyController } from "./safety.controller";
import { SafetyService } from "./safety.service";
import { ConversationsService } from "../conversations/conversations.service";

describe("Safety access boundaries", () => {
  let app: any;
  const service = {
    queue: jest.fn().mockResolvedValue({ data: [] }),
    review: jest.fn(),
    report: jest.fn(),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SafetyController],
      providers: [{ provide: SafetyService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          if (!req.headers["x-test-user"]) return false;
          req.user = {
            id: "user",
            isAdmin: req.headers["x-test-user"] === "admin",
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it("rejects anonymous and regular-user access to moderation", async () => {
    await request(app.getHttpServer()).get("/safety/reports").expect(403);
    await request(app.getHttpServer())
      .get("/safety/reports")
      .set("x-test-user", "member")
      .expect(403);
    await request(app.getHttpServer())
      .patch("/safety/reports/11111111-1111-4111-8111-111111111111")
      .set("x-test-user", "member")
      .send({ action: "hide" })
      .expect(403);
    expect(service.queue).not.toHaveBeenCalled();
    expect(service.review).not.toHaveBeenCalled();
  });
  it("permits admins, prevents cached private queues, and validates input", async () => {
    await request(app.getHttpServer())
      .get("/safety/reports")
      .set("x-test-user", "admin")
      .expect("Cache-Control", "no-store")
      .expect(200);
    await request(app.getHttpServer())
      .get("/safety/reports?page=-1")
      .set("x-test-user", "admin")
      .expect(400);
    await request(app.getHttpServer())
      .post("/safety/reports")
      .set("x-test-user", "member")
      .send({
        targetType: "conversation_message",
        targetId: "invalid",
        reason: "spam",
      })
      .expect(400);
    expect(service.report).not.toHaveBeenCalled();
  });
});

describe("Safety enforcement", () => {
  const query = jest.fn();
  let service: SafetyService;
  beforeEach(() => {
    query.mockReset();
    service = new SafetyService({
      query,
      transaction: (fn: any) => fn({ query }),
    } as unknown as DataSource);
  });
  it("checks both directions and never permits a blocked message", async () => {
    query.mockResolvedValue([{ exists: 1 }]);
    await expect(
      service.assertCanContact("sender", ["sender", "recipient", "recipient"]),
    ).rejects.toThrow(ForbiddenException);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("OR (blocked_user_id = $1"),
      ["sender", ["recipient"]],
    );
  });
  it("does not snapshot a private message for a nonparticipant", async () => {
    query.mockResolvedValue([]);
    await expect(
      service.report("outsider", {
        targetType: "conversation_message",
        targetId: "message",
        reason: "spam",
      }),
    ).rejects.toThrow("unavailable");
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("p.user_id = $2"),
      ["message", "outsider"],
    );
  });
  it("only removes the caller’s block", async () => {
    query.mockResolvedValue([]);
    await service.unblock("caller", "other");
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("blocker_id = $1 AND blocked_user_id = $2"),
      ["caller", "other"],
    );
  });
  it("preserves prior moderation decisions", async () => {
    query.mockResolvedValue([{ reviewed_at: new Date() }]);
    await expect(service.review("admin", "report", "hide")).rejects.toThrow(
      "already been reviewed",
    );
    expect(query).toHaveBeenCalledTimes(1);
  });
  it("removes reported message text/media and records the decision together", async () => {
    query
      .mockResolvedValueOnce([
        { target_type: "conversation_message", target_id: "message" },
      ])
      .mockResolvedValue([]);
    await service.review("admin", "report", "hide");
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("attachments = '[]'::jsonb"),
      ["message"],
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("reviewed_by = $2"),
      ["report", "admin", "hide"],
    );
  });
  it("rejects sends before saving or notifying, including the shared websocket service path", async () => {
    const participants = {
      findOne: jest.fn().mockResolvedValue({ userId: "sender" }),
    };
    const messages = { save: jest.fn() };
    const notifications = { createMany: jest.fn() };
    const safety = {
      assertConversation: jest
        .fn()
        .mockRejectedValue(new ForbiddenException("Blocked")),
    };
    const conversations = new ConversationsService(
      {} as never,
      participants as never,
      messages as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      notifications as never,
      safety as never,
    );
    await expect(
      conversations.send("sender", "conversation", { body: "hello" } as never),
    ).rejects.toThrow("Blocked");
    expect(messages.save).not.toHaveBeenCalled();
    expect(notifications.createMany).not.toHaveBeenCalled();
  });
});
