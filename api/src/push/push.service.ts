import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as webpush from "web-push";
import { PushSubscription } from "./entities/push-subscription.entity";
import { SubscribePushDto } from "./dto/subscribe-push.dto";
import { AppConfig } from "../config/configuration";

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly configured: boolean;
  private readonly publicKey: string;

  constructor(
    configService: ConfigService<AppConfig, true>,
    @InjectRepository(PushSubscription)
    private readonly subscriptionRepo: Repository<PushSubscription>,
  ) {
    const { publicKey, privateKey, contactEmail } = configService.get(
      "webPush",
      { infer: true },
    );
    this.publicKey = publicKey;
    this.configured = Boolean(publicKey && privateKey);

    if (this.configured) {
      webpush.setVapidDetails(contactEmail, publicKey, privateKey);
    } else {
      // Push is a progressive enhancement, not core functionality — an
      // unconfigured VAPID keypair (the .env.example default) should mean
      // "notifications quietly don't send," not "the app won't boot."
      this.logger.warn(
        "VAPID keys not configured — push notifications are disabled. See api/README.md.",
      );
    }
  }

  getPublicKey(): string | null {
    return this.configured ? this.publicKey : null;
  }

  async subscribe(userId: string, dto: SubscribePushDto): Promise<void> {
    const existing = await this.subscriptionRepo.findOne({
      where: { endpoint: dto.endpoint },
    });
    if (existing) {
      existing.userId = userId;
      existing.p256dh = dto.keys.p256dh;
      existing.auth = dto.keys.auth;
      await this.subscriptionRepo.save(existing);
      return;
    }
    await this.subscriptionRepo.save(
      this.subscriptionRepo.create({
        userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
      }),
    );
  }

  async unsubscribe(endpoint: string): Promise<void> {
    await this.subscriptionRepo.delete({ endpoint });
  }

  /** Sends to every subscription belonging to the given users. Best-effort:
   * failures for one subscriber never block the others, and a subscription
   * the push service reports as gone (410/404) is cleaned up. */
  async sendToUsers(
    userIds: string[],
    payload: { title: string; body: string; url?: string },
  ): Promise<void> {
    if (!this.configured || userIds.length === 0) {
      return;
    }

    const subscriptions = await this.subscriptionRepo
      .createQueryBuilder("sub")
      .where("sub.userId IN (:...userIds)", { userIds })
      .getMany();

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify(payload),
          );
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await this.subscriptionRepo.delete({ id: sub.id });
          } else {
            this.logger.warn(
              `Push send failed for subscription ${sub.id}: ${(error as Error).message}`,
            );
          }
        }
      }),
    );
  }
}
