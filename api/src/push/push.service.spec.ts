import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as webpush from "web-push";
import { PushService } from "./push.service";
import { PushSubscription } from "./entities/push-subscription.entity";

// setVapidDetails() validates the public key's shape synchronously, so a
// "configured" test needs a structurally real keypair, not a placeholder
// string — generate one rather than hard-coding a magic value.
const VALID_VAPID = {
  ...webpush.generateVAPIDKeys(),
  contactEmail: "mailto:a@example.com",
};

describe("PushService", () => {
  let subscriptionRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };

  async function buildService(webPushConfig: {
    publicKey: string;
    privateKey: string;
    contactEmail: string;
  }) {
    subscriptionRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((x) => x),
      delete: jest.fn(),
    };
    const configService = { get: jest.fn().mockReturnValue(webPushConfig) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushService,
        { provide: ConfigService, useValue: configService },
        {
          provide: getRepositoryToken(PushSubscription),
          useValue: subscriptionRepo,
        },
      ],
    }).compile();

    return module.get(PushService);
  }

  it("reports itself unconfigured (and returns no public key) when VAPID keys are empty", async () => {
    const service = await buildService({
      publicKey: "",
      privateKey: "",
      contactEmail: "mailto:a@example.com",
    });
    expect(service.getPublicKey()).toBeNull();
  });

  it("reports itself configured and returns the public key when VAPID keys are set", async () => {
    const service = await buildService(VALID_VAPID);
    expect(service.getPublicKey()).toBe(VALID_VAPID.publicKey);
  });

  it("sendToUsers is a no-op when unconfigured — never queries subscriptions", async () => {
    const service = await buildService({
      publicKey: "",
      privateKey: "",
      contactEmail: "mailto:a@example.com",
    });
    await service.sendToUsers(["user-1"], { title: "t", body: "b" });
    expect(subscriptionRepo.findOne).not.toHaveBeenCalled();
  });

  it("subscribe updates an existing subscription by endpoint instead of creating a duplicate", async () => {
    const service = await buildService(VALID_VAPID);
    const existing = {
      id: "sub-1",
      endpoint: "https://example.com/ep",
      userId: "old-user",
      p256dh: "old",
      auth: "old",
    };
    subscriptionRepo.findOne.mockResolvedValue(existing);

    await service.subscribe("new-user", {
      endpoint: "https://example.com/ep",
      keys: { p256dh: "new", auth: "new" },
    });

    expect(subscriptionRepo.create).not.toHaveBeenCalled();
    expect(subscriptionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "new-user",
        p256dh: "new",
        auth: "new",
      }),
    );
  });
});
