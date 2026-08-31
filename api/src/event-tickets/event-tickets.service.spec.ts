import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { EventTicketsService } from "./event-tickets.service";
import {
  EventTicketOrder,
  EventTicketOrderStatus,
} from "./entities/event-ticket-order.entity";
import { EventReviewStatus } from "../events/entities/event.enums";

const user = { id: "buyer-1", isAdmin: false } as any;
const organizer = { id: "organizer-1", isAdmin: false } as any;

function setup() {
  const event = {
    id: "event-1",
    createdByUserId: organizer.id,
    reviewStatus: EventReviewStatus.APPROVED,
    ticketPrice: "500",
    ticketCurrency: "LRD",
    ticketCapacity: 10,
  } as any;
  const saved: EventTicketOrder[] = [];
  const eventRepo = { findOne: jest.fn().mockResolvedValue(event) };
  const orderRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest
      .fn()
      .mockImplementation(({ where }: any) =>
        Promise.resolve(saved.find((item) => item.id === where.id) ?? null),
      ),
    create: jest
      .fn()
      .mockImplementation((input) => ({ id: "order-1", ...input })),
    save: jest.fn().mockImplementation((order) => {
      const existing = saved.findIndex((item) => item.id === order.id);
      if (existing >= 0) saved[existing] = order;
      else saved.push(order);
      return Promise.resolve(order);
    }),
  };
  const service = new EventTicketsService(
    eventRepo as any,
    {} as any,
    orderRepo as any,
  );
  return { service, eventRepo, orderRepo, saved };
}

describe("EventTicketsService", () => {
  it("creates a pending manual-payment order with the calculated total", async () => {
    const { service } = setup();
    const order = await service.createOrder("event-1", user, {
      quantity: 2,
      paymentReference: "MM-12345",
    });
    expect(order.status).toBe(EventTicketOrderStatus.PENDING_PAYMENT_REVIEW);
    expect(order.totalAmount).toBe("1000.00");
    expect(order.currency).toBe("LRD");
  });

  it("rejects an order that exceeds remaining capacity", async () => {
    const { service, orderRepo } = setup();
    orderRepo.find.mockResolvedValue([
      { quantity: 9, status: EventTicketOrderStatus.APPROVED },
    ]);
    await expect(
      service.createOrder("event-1", user, {
        quantity: 2,
        paymentReference: "MM-2",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("requires selections for an event with ticket types", async () => {
    const { service, eventRepo, orderRepo } = setup();
    eventRepo.findOne.mockResolvedValue({
      id: "event-1",
      createdByUserId: organizer.id,
      reviewStatus: EventReviewStatus.APPROVED,
      ticketPrice: null,
      ticketTypes: [{ id: "vip", name: "VIP", price: "1000", quantity: 5 }],
    });

    await expect(
      service.createOrder("event-1", user, {
        quantity: 1,
        paymentReference: "MM-typed",
      }),
    ).rejects.toThrow("Choose at least one ticket type for this event");
    expect(orderRepo.create).not.toHaveBeenCalled();
  });

  it("allows only the organizer to approve and issues a ticket code", async () => {
    const { service, saved } = setup();
    const order = await service.createOrder("event-1", user, {
      quantity: 1,
      paymentReference: "MM-98765",
    });
    const approved = await service.reviewOrder(order.id, organizer, {
      status: EventTicketOrderStatus.APPROVED,
    });
    expect(approved.status).toBe(EventTicketOrderStatus.APPROVED);
    expect(approved.ticketCode).toMatch(/^L360-/);
    expect(saved[0].ticketCode).toBe(approved.ticketCode);
  });

  it("blocks a non-organizer from reviewing an order", async () => {
    const { service } = setup();
    const order = await service.createOrder("event-1", user, {
      quantity: 1,
      paymentReference: "MM-55555",
    });
    await expect(
      service.reviewOrder(order.id, user, {
        status: EventTicketOrderStatus.REJECTED,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
