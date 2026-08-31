import { randomUUID } from "crypto";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { EventTicketsService } from "./event-tickets.service";
import {
  EventTicketOrder,
  EventTicketOrderStatus,
} from "./entities/event-ticket-order.entity";
import { EventTicketInstanceStatus } from "./entities/event-ticket-instance.entity";
import { EventReviewStatus } from "../events/entities/event.enums";

// The service's randomBytes(32) generates each ticket's plaintext QR
// token; pinning it to a known value lets these tests build a valid scan
// payload for any issued instance directly (`instanceId:FIXED_TOKEN`)
// without decoding a rendered QR image. randomBytes(12) — the AES-GCM
// IV — is left real so encryption still round-trips correctly; randomUUID
// (ticketCode generation) is untouched entirely.
const FIXED_TOKEN = Buffer.alloc(32, 7).toString("base64url");
jest.mock("crypto", () => {
  const actual = jest.requireActual("crypto");
  return {
    ...actual,
    randomBytes: (size: number) =>
      size === 32 ? Buffer.alloc(32, 7) : actual.randomBytes(size),
  };
});

const user = { id: "buyer-1", isAdmin: false } as any;
const organizer = { id: "organizer-1", isAdmin: false } as any;

// Mimics TypeORM's `where` matching closely enough for these tests: plain
// value equality, plus the one FindOperator the service actually uses
// (IsNull(), for a null ticketTypeId on legacy/non-typed tickets).
function matchesWhere(item: any, where: Record<string, any>): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (value && typeof value === "object" && "_type" in value) {
      if (value._type === "isNull")
        return item[key] === null || item[key] === undefined;
      return true;
    }
    return item[key] === value;
  });
}

function setup() {
  const event = {
    id: "event-1",
    name: "Monrovia Music Festival",
    createdByUserId: organizer.id,
    reviewStatus: EventReviewStatus.APPROVED,
    ticketPrice: "500",
    ticketCurrency: "LRD",
    ticketCapacity: 10,
  } as any;
  const saved: EventTicketOrder[] = [];
  const instances: any[] = [];

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

  const instanceRepo = {
    create: jest.fn((input: any) => ({ id: randomUUID(), ...input })),
    save: jest.fn((rows: any) => {
      const list = Array.isArray(rows) ? rows : [rows];
      for (const row of list) {
        const idx = instances.findIndex((r) => r.id === row.id);
        if (idx >= 0) instances[idx] = row;
        else instances.push(row);
      }
      return Promise.resolve(rows);
    }),
    find: jest.fn(({ where, order: orderBy }: any = {}) => {
      let rows = instances.filter((r) =>
        where ? matchesWhere(r, where) : true,
      );
      if (orderBy?.sequence)
        rows = [...rows].sort((a, b) =>
          orderBy.sequence === "ASC"
            ? a.sequence - b.sequence
            : b.sequence - a.sequence,
        );
      return Promise.resolve(rows);
    }),
    count: jest.fn(({ where }: any = {}) =>
      Promise.resolve(instances.filter((r) => matchesWhere(r, where)).length),
    ),
    findOne: jest.fn(({ where, relations }: any = {}) => {
      const row = instances.find((r) => matchesWhere(r, where));
      if (!row) return Promise.resolve(null);
      if (relations?.order) {
        return Promise.resolve({
          ...row,
          order: saved.find((o) => o.id === row.orderId),
        });
      }
      return Promise.resolve(row);
    }),
    createQueryBuilder: jest.fn(() => {
      let updateSet: Record<string, any> = {};
      const wheres: Array<{ sql: string; params: any }> = [];
      const builder: any = {
        update: jest.fn(() => builder),
        set: jest.fn((values: any) => {
          updateSet = values;
          return builder;
        }),
        where: jest.fn((sql: string, params: any) => {
          wheres.push({ sql, params });
          return builder;
        }),
        andWhere: jest.fn((sql: string, params: any) => {
          wheres.push({ sql, params });
          return builder;
        }),
        execute: jest.fn(() => {
          const id = wheres.find((w) => w.sql.startsWith("id"))?.params?.id;
          const requiredStatus = wheres.find((w) => w.sql.startsWith("status"))
            ?.params?.status;
          const row = instances.find((r) => r.id === id);
          if (!row || (requiredStatus && row.status !== requiredStatus)) {
            return Promise.resolve({ affected: 0 });
          }
          for (const [key, value] of Object.entries(updateSet)) {
            row[key] = typeof value === "function" ? row[key] : value;
          }
          return Promise.resolve({ affected: 1 });
        }),
      };
      return builder;
    }),
  };

  const service = new EventTicketsService(
    eventRepo as any,
    {} as any,
    orderRepo as any,
    instanceRepo as any,
  );
  return { service, eventRepo, orderRepo, saved, instanceRepo, instances };
}

function payloadFor(instanceId: string, token = FIXED_TOKEN) {
  return `L360TICKET:v1:${instanceId}:${token}`;
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

  it("aggregates repeated selections of the same ticket type before checking capacity", async () => {
    const { service, eventRepo } = setup();
    eventRepo.findOne.mockResolvedValue({
      id: "event-1",
      createdByUserId: organizer.id,
      reviewStatus: EventReviewStatus.APPROVED,
      ticketPrice: null,
      ticketTypes: [{ id: "vip", name: "VIP", price: "10", quantity: 10 }],
    });

    // Two lines of 8 each for the same type: neither exceeds the 10-ticket
    // capacity alone, but together they oversell it by 6 — the aggregate
    // check (not each line independently) must catch that.
    await expect(
      service.createOrder("event-1", user, {
        selections: [
          { ticketTypeId: "vip", quantity: 8 },
          { ticketTypeId: "vip", quantity: 8 },
        ],
        paymentReference: "MM-dup",
      }),
    ).rejects.toThrow("Not enough VIP tickets remain");
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

  describe("individual per-type ticket issuance", () => {
    it("issues one instance per ticket, each stamped with its own type — not one generic batch", async () => {
      const { service, eventRepo, instances } = setup();
      eventRepo.findOne.mockResolvedValue({
        id: "event-1",
        name: "Monrovia Music Festival",
        createdByUserId: organizer.id,
        reviewStatus: EventReviewStatus.APPROVED,
        ticketPrice: null,
        ticketTypes: [
          { id: "vip", name: "VIP", price: "50", quantity: 20 },
          { id: "reg", name: "Regular", price: "20", quantity: 50 },
        ],
      });

      const order = await service.createOrder("event-1", user, {
        selections: [
          { ticketTypeId: "vip", quantity: 2 },
          { ticketTypeId: "reg", quantity: 3 },
        ],
        paymentReference: "MM-multi",
      });
      await service.reviewOrder(order.id, organizer, {
        status: EventTicketOrderStatus.APPROVED,
      });

      const issued = instances.filter((i) => i.orderId === order.id);
      expect(issued).toHaveLength(5);

      const vipTickets = issued.filter((i) => i.ticketTypeName === "VIP");
      const regTickets = issued.filter((i) => i.ticketTypeName === "Regular");
      expect(vipTickets).toHaveLength(2);
      expect(regTickets).toHaveLength(3);

      // Each ticket gets its own unique number, prefixed by its own type's
      // code — never a shared per-order code standing in for all of them.
      expect(new Set(issued.map((i) => i.ticketNumber)).size).toBe(5);
      for (const ticket of vipTickets)
        expect(ticket.ticketNumber).toMatch(/^L360-VIP-\d{5}$/);
      for (const ticket of regTickets)
        expect(ticket.ticketNumber).toMatch(/^L360-REG-\d{5}$/);

      // "Ticket X of 5" in the buyer's list is just each instance's
      // position (1-based) within the order, spanning every type.
      expect(issued.map((i) => i.sequence).sort((a, b) => a - b)).toEqual([
        1, 2, 3, 4, 5,
      ]);
    });

    it("issues generic 'General Admission' tickets for a legacy non-typed event", async () => {
      const { service, instances } = setup();
      const order = await service.createOrder("event-1", user, {
        quantity: 3,
        paymentReference: "MM-legacy",
      });
      await service.reviewOrder(order.id, organizer, {
        status: EventTicketOrderStatus.APPROVED,
      });

      const issued = instances.filter((i) => i.orderId === order.id);
      expect(issued).toHaveLength(3);
      for (const ticket of issued) {
        expect(ticket.ticketTypeName).toBe("General Admission");
        expect(ticket.ticketTypeId).toBeNull();
        expect(ticket.ticketNumber).toMatch(/^L360-GA-\d{5}$/);
      }
    });

    it("continues each type's numbering across separate orders instead of restarting at 1", async () => {
      const { service, eventRepo, instances } = setup();
      eventRepo.findOne.mockResolvedValue({
        id: "event-1",
        name: "Monrovia Music Festival",
        createdByUserId: organizer.id,
        reviewStatus: EventReviewStatus.APPROVED,
        ticketPrice: null,
        ticketTypes: [{ id: "vip", name: "VIP", price: "50", quantity: 20 }],
      });

      const first = await service.createOrder("event-1", user, {
        selections: [{ ticketTypeId: "vip", quantity: 2 }],
        paymentReference: "MM-first",
      });
      await service.reviewOrder(first.id, organizer, {
        status: EventTicketOrderStatus.APPROVED,
      });
      const second = await service.createOrder("event-1", user, {
        selections: [{ ticketTypeId: "vip", quantity: 1 }],
        paymentReference: "MM-second",
      });
      await service.reviewOrder(second.id, organizer, {
        status: EventTicketOrderStatus.APPROVED,
      });

      const numbers = instances.map((i) => i.ticketNumber).sort();
      expect(numbers).toEqual([
        "L360-VIP-00001",
        "L360-VIP-00002",
        "L360-VIP-00003",
      ]);
    });
  });

  describe("redeemTicket — scan outcomes", () => {
    async function issueTickets(overrides?: {
      ticketTypes?: any[];
      selections?: Array<{ ticketTypeId: string; quantity: number }>;
      quantity?: number;
    }) {
      const context = setup();
      const { service, eventRepo } = context;
      if (overrides?.ticketTypes) {
        eventRepo.findOne.mockResolvedValue({
          id: "event-1",
          name: "Monrovia Music Festival",
          createdByUserId: organizer.id,
          reviewStatus: EventReviewStatus.APPROVED,
          ticketPrice: null,
          ticketTypes: overrides.ticketTypes,
        });
      }
      const order = await service.createOrder("event-1", user, {
        quantity: overrides?.selections
          ? undefined
          : (overrides?.quantity ?? 1),
        selections: overrides?.selections,
        paymentReference: "MM-scan",
      });
      await service.reviewOrder(order.id, organizer, {
        status: EventTicketOrderStatus.APPROVED,
      });
      const orderInstances = context.instances.filter(
        (i) => i.orderId === order.id,
      );
      return { ...context, order, instance: orderInstances[0], orderInstances };
    }

    it("accepts a valid, unused ticket and marks it (and only it) redeemed", async () => {
      const { service, instance } = await issueTickets();
      const result = await service.redeemTicket("event-1", organizer, {
        payload: payloadFor(instance.id),
      });
      expect(result.outcome).toBe("valid");
      expect(result.message).toBe("Entry approved.");
      expect(result.ticket).toEqual({
        id: instance.id,
        ticketNumber: instance.ticketNumber,
        ticketTypeName: "General Admission",
        eventName: "Monrovia Music Festival",
        orderId: instance.orderId,
      });
      expect(instance.status).toBe(EventTicketInstanceStatus.REDEEMED);
    });

    it("reports already_used with the original scan time on a second scan, and rejects entry", async () => {
      const { service, instance } = await issueTickets();
      const first = await service.redeemTicket("event-1", organizer, {
        payload: payloadFor(instance.id),
      });
      expect(first.outcome).toBe("valid");

      const second = await service.redeemTicket("event-1", organizer, {
        payload: payloadFor(instance.id),
      });
      expect(second.outcome).toBe("already_used");
      expect(second.firstScannedAt).toBeDefined();
      expect(second.ticket?.id).toBe(instance.id);
    });

    it("leaves the rest of a multi-ticket order untouched when only one ticket is scanned", async () => {
      const { service, orderInstances } = await issueTickets({
        ticketTypes: [
          { id: "vip", name: "VIP", price: "50", quantity: 20 },
          { id: "reg", name: "Regular", price: "20", quantity: 50 },
        ],
        selections: [
          { ticketTypeId: "vip", quantity: 2 },
          { ticketTypeId: "reg", quantity: 3 },
        ],
      });
      expect(orderInstances).toHaveLength(5);
      const [firstVip] = orderInstances.filter(
        (i) => i.ticketTypeName === "VIP",
      );

      const result = await service.redeemTicket("event-1", organizer, {
        payload: payloadFor(firstVip.id),
      });
      expect(result.outcome).toBe("valid");

      const redeemed = orderInstances.filter(
        (i) => i.status === EventTicketInstanceStatus.REDEEMED,
      );
      const stillIssued = orderInstances.filter(
        (i) => i.status === EventTicketInstanceStatus.ISSUED,
      );
      expect(redeemed).toEqual([firstVip]);
      expect(stillIssued).toHaveLength(4);
    });

    it("reports cancelled for a voided ticket and never allows entry", async () => {
      const { service, instance } = await issueTickets();
      await service.voidTicket(instance.id, organizer);
      const result = await service.redeemTicket("event-1", organizer, {
        payload: payloadFor(instance.id),
      });
      expect(result.outcome).toBe("cancelled");
    });

    it("blocks a non-organizer from cancelling a ticket", async () => {
      const { service, instance } = await issueTickets();
      await expect(
        service.voidTicket(instance.id, user),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("rejects cancelling an already-cancelled ticket", async () => {
      const { service, instance } = await issueTickets();
      await service.voidTicket(instance.id, organizer);
      await expect(
        service.voidTicket(instance.id, organizer),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("reports wrong_event when a genuine ticket is scanned against a different event", async () => {
      const { service, eventRepo, instance } = await issueTickets();
      // A second event, organized by the same user, scanning the first
      // event's ticket by mistake.
      eventRepo.findOne.mockResolvedValue({
        id: "event-2",
        name: "Buchanan Beach Party",
        createdByUserId: organizer.id,
        reviewStatus: EventReviewStatus.APPROVED,
      });
      const result = await service.redeemTicket("event-2", organizer, {
        payload: payloadFor(instance.id),
      });
      expect(result.outcome).toBe("wrong_event");
      expect(result.ticket?.eventName).toBe("Monrovia Music Festival");
    });

    it("reports invalid for a malformed payload without leaking any ticket state", async () => {
      const { service } = await issueTickets();
      const result = await service.redeemTicket("event-1", organizer, {
        payload: "not-a-real-payload-at-all-just-garbage-text-1234567890",
      });
      expect(result.outcome).toBe("invalid");
      expect(result.ticket).toBeUndefined();
    });

    it("reports invalid for an unknown instance id", async () => {
      const { service } = await issueTickets();
      const result = await service.redeemTicket("event-1", organizer, {
        payload: payloadFor(randomUUID()),
      });
      expect(result.outcome).toBe("invalid");
      expect(result.ticket).toBeUndefined();
    });

    it("reports invalid for a well-formed payload with a tampered token, revealing nothing about the real ticket", async () => {
      const { service, instance } = await issueTickets();
      const tamperedToken = "x".repeat(43);
      const result = await service.redeemTicket("event-1", organizer, {
        payload: payloadFor(instance.id, tamperedToken),
      });
      expect(result.outcome).toBe("invalid");
      expect(result.ticket).toBeUndefined();
      // And the real ticket is untouched — the tampered attempt didn't
      // consume it.
      expect(instance.status).toBe(EventTicketInstanceStatus.ISSUED);
    });
  });
});
