import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { SupportService } from "./support.service";
import { SupportTicketStatus } from "./entities/support-ticket.entity";

const customer = { id: "customer-1", isAdmin: false } as any;
const agent = { id: "agent-1", isAdmin: true } as any;

function setup(ticketOverrides: Record<string, unknown> = {}) {
  const ticket = {
    id: "ticket-1",
    reference: "L360-TEST",
    customerUserId: customer.id,
    assignedAgentUserId: null,
    subject: "Unable to complete booking",
    status: SupportTicketStatus.RESOLVED,
    rating: null,
    ratingComment: null,
    closedAt: null,
    ...ticketOverrides,
  } as any;
  const tickets = {
    findOne: jest.fn().mockResolvedValue(ticket),
    save: jest.fn(async (value) => value),
    create: jest.fn((value) => value),
  } as any;
  const messages = {} as any;
  const users = { findOne: jest.fn(), find: jest.fn() } as any;
  const notifications = { create: jest.fn(), createMany: jest.fn() } as any;
  return {
    ticket,
    tickets,
    users,
    notifications,
    service: new SupportService(tickets, messages, users, notifications),
  };
}

describe("SupportService", () => {
  describe("confirmResolved", () => {
    it("closes a resolved ticket and stores required rating and feedback", async () => {
      const { service, tickets } = setup();

      const result = await service.confirmResolved(customer, "ticket-1", {
        rating: 5,
        comment: "Fast and helpful response",
      });

      expect(result).toMatchObject({
        status: SupportTicketStatus.CLOSED,
        rating: 5,
        ratingComment: "Fast and helpful response",
      });
      expect(result.closedAt).toBeInstanceOf(Date);
      expect(tickets.save).toHaveBeenCalledTimes(1);
    });

    it("does not let another customer confirm resolution", async () => {
      const { service } = setup();
      await expect(
        service.confirmResolved({ id: "someone-else" } as any, "ticket-1", {
          rating: 4,
          comment: "Resolved successfully",
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("rejects confirmation before an administrator resolves the ticket", async () => {
      const { service } = setup({ status: SupportTicketStatus.IN_PROGRESS });
      await expect(
        service.confirmResolved(customer, "ticket-1", {
          rating: 4,
          comment: "Resolved successfully",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("assignment", () => {
    it("allows assignment to any administrator and notifies them", async () => {
      const { service, users, notifications } = setup({
        status: SupportTicketStatus.OPEN,
      });
      users.findOne.mockResolvedValue({ id: "agent-2", isAdmin: true });

      const result = await service.update(agent, "ticket-1", {
        assignedAgentUserId: "agent-2",
      });

      expect(result.assignedAgentUserId).toBe("agent-2");
      expect(notifications.create).toHaveBeenCalledWith(
        "agent-2",
        expect.objectContaining({ type: "admin.support_ticket_assigned" }),
      );
    });

    it("rejects assignment to a non-administrator", async () => {
      const { service, users } = setup({ status: SupportTicketStatus.OPEN });
      users.findOne.mockResolvedValue({ id: "customer-2", isAdmin: false });

      await expect(
        service.update(agent, "ticket-1", {
          assignedAgentUserId: "customer-2",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
