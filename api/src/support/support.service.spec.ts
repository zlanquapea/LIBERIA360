import { BadRequestException } from "@nestjs/common";
import { Repository } from "typeorm";
import { NotificationsService } from "../notifications/notifications.service";
import { User } from "../users/entities/user.entity";
import { SupportMessage } from "./entities/support-message.entity";
import {
  SupportTicket,
  SupportTicketStatus,
} from "./entities/support-ticket.entity";
import { SupportService } from "./support.service";

describe("SupportService assignment and feedback", () => {
  const ticketRepo = {
    findOne: jest.fn(),
    save: jest.fn(async (value) => value),
    update: jest.fn(),
  } as unknown as Repository<SupportTicket>;
  const service = new SupportService(
    ticketRepo,
    {} as Repository<SupportMessage>,
    {} as Repository<User>,
    {} as NotificationsService,
  );
  const agent = { id: "agent-1", name: "Agent One", isAdmin: true } as User;

  beforeEach(() => jest.clearAllMocks());

  it("lets an admin claim an unassigned ticket for themselves", async () => {
    const ticket = {
      id: "ticket-1",
      assignedAgentUserId: null,
    } as SupportTicket;
    (ticketRepo.findOne as jest.Mock)
      .mockResolvedValueOnce(ticket)
      .mockResolvedValueOnce({ ...ticket, assignedAgentUserId: agent.id });
    (ticketRepo.update as jest.Mock).mockResolvedValue({ affected: 1 });

    const result = await service.assignToSelf(agent, ticket.id);

    expect(result.assignedAgentUserId).toBe(agent.id);
    expect(ticketRepo.update).toHaveBeenCalled();
  });

  it("does not let an admin take a ticket owned by another agent", async () => {
    const ticket = {
      id: "ticket-1",
      assignedAgentUserId: "agent-2",
      assignedAgent: { name: "Agent Two" },
    } as SupportTicket;
    (ticketRepo.findOne as jest.Mock).mockResolvedValue(ticket);

    await expect(service.assignToSelf(agent, ticket.id)).rejects.toThrow(
      new BadRequestException("This ticket is already assigned to Agent Two"),
    );
    expect(ticketRepo.save).not.toHaveBeenCalled();
  });

  it("stores both the rating and the customer's trimmed comment", async () => {
    const ticket = {
      id: "ticket-1",
      customerUserId: "customer-1",
      status: SupportTicketStatus.CLOSED,
      rating: null,
      ratingComment: null,
    } as SupportTicket;
    (ticketRepo.findOne as jest.Mock).mockResolvedValue(ticket);

    await service.rate({ id: "customer-1" } as User, ticket.id, {
      rating: 5,
      comment: "  Thoughtful and fast support.  ",
    });

    expect(ticket.rating).toBe(5);
    expect(ticket.ratingComment).toBe("Thoughtful and fast support.");
  });
});
