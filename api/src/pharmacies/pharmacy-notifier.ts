import { Injectable, Logger, Optional } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotificationsService } from "../notifications/notifications.service";
import type { NotificationType } from "../notifications/entities/notification.entity";
import { PharmacyStaff } from "./entities/pharmacy.entity";
import type { PharmacyOrder } from "./entities/order.entity";

/**
 * In-app (and push, per the user's preferences) notifications for pharmacy
 * orders. The customer hears about every step of their order; on the
 * pharmacy side every active staff member is told, since whoever is behind
 * the counter should be able to pick an order up.
 *
 * Never throws: a notification failing must not undo or fail the order
 * change that triggered it.
 */
@Injectable()
export class PharmacyNotifier {
  private readonly logger = new Logger(PharmacyNotifier.name);

  constructor(
    @InjectRepository(PharmacyStaff)
    private readonly staff: Repository<PharmacyStaff>,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  async customer(
    order: Pick<PharmacyOrder, "customerUserId">,
    type: NotificationType,
    title: string,
    body: string,
  ) {
    if (!this.notifications) return;
    try {
      await this.notifications.create(order.customerUserId, {
        type,
        title,
        body,
        link: "/account/my-orders",
      });
    } catch (error) {
      this.logger.warn(`Customer notification failed: ${String(error)}`);
    }
  }

  async staffOf(
    pharmacyId: string,
    type: NotificationType,
    title: string,
    body: string,
    exceptUserId?: string,
  ) {
    if (!this.notifications) return;
    try {
      const members = await this.staff.find({
        where: { pharmacyId, active: true },
      });
      await Promise.all(
        members
          .filter((m) => m.userId !== exceptUserId)
          .map((m) =>
            this.notifications!.create(m.userId, {
              type,
              title,
              body,
              link: `/account/pharmacy-dashboard/${pharmacyId}/orders`,
            }),
          ),
      );
    } catch (error) {
      this.logger.warn(`Staff notification failed: ${String(error)}`);
    }
  }
}

/** Short, human order reference: the first 8 characters of the id. */
export function orderRef(orderId: string) {
  return `#${orderId.slice(0, 8).toUpperCase()}`;
}

export function lrd(amount: number | string) {
  return `L$${Number(amount).toFixed(2)}`;
}
