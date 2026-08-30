import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import { NotificationsService } from "../notifications/notifications.service";
import { User } from "../users/entities/user.entity";
import {
  CreateSupportMessageDto,
  CreateSupportTicketDto,
  QuerySupportTicketsDto,
  RateSupportTicketDto,
  UpdateSupportTicketDto,
} from "./dto/support.dto";
import { SupportMessage } from "./entities/support-message.entity";
import {
  SupportTicket,
  SupportTicketStatus,
} from "./entities/support-ticket.entity";

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly tickets: Repository<SupportTicket>,
    @InjectRepository(SupportMessage)
    private readonly messages: Repository<SupportMessage>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly notifications: NotificationsService,
  ) {}

  private async get(id: string): Promise<SupportTicket> {
    const ticket = await this.tickets.findOne({ where: { id } });
    if (!ticket)
      throw new NotFoundException(`Support ticket "${id}" not found`);
    return ticket;
  }
  private assertAccess(user: User, ticket: SupportTicket) {
    if (!user.isAdmin && ticket.customerUserId !== user.id)
      throw new ForbiddenException("You cannot access this support ticket");
  }
  private async adminIds(): Promise<string[]> {
    return (
      await this.users.find({ select: { id: true }, where: { isAdmin: true } })
    ).map((u) => u.id);
  }

  async findAgents() {
    return this.users.find({
      where: { isAdmin: true },
      order: { name: "ASC" },
    });
  }

  async create(customer: User, dto: CreateSupportTicketDto) {
    let ticket = await this.tickets.save(
      this.tickets.create({
        ...dto,
        customerUserId: customer.id,
        reference: `L360-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      }),
    );
    ticket = await this.get(ticket.id);
    await this.notifications.createMany(await this.adminIds(), {
      type: "admin.support_ticket_created",
      title: "New support ticket",
      body: `${ticket.reference}: ${ticket.subject}`,
      link: `/admin/support/${ticket.id}`,
    });
    return ticket;
  }
  findMine(userId: string) {
    return this.tickets.find({
      where: { customerUserId: userId },
      order: { updatedAt: "DESC" },
    });
  }
  async findOne(user: User, id: string) {
    const ticket = await this.get(id);
    this.assertAccess(user, ticket);
    return ticket;
  }

  async findAll(query: QuerySupportTicketsDto) {
    const qb = this.tickets
      .createQueryBuilder("ticket")
      .leftJoinAndSelect("ticket.customer", "customer")
      .leftJoinAndSelect("ticket.assignedAgent", "agent")
      .orderBy("ticket.updatedAt", "DESC");
    if (query.status)
      qb.andWhere("ticket.status = :status", { status: query.status });
    if (query.priority)
      qb.andWhere("ticket.priority = :priority", { priority: query.priority });
    if (query.category)
      qb.andWhere("ticket.category = :category", { category: query.category });
    if (query.customerUserId)
      qb.andWhere("ticket.customerUserId = :customerUserId", {
        customerUserId: query.customerUserId,
      });
    if (query.dateFrom)
      qb.andWhere("ticket.createdAt >= :dateFrom", {
        dateFrom: query.dateFrom,
      });
    if (query.dateTo)
      qb.andWhere("ticket.createdAt <= :dateTo", { dateTo: query.dateTo });
    if (query.search)
      qb.andWhere(
        new Brackets((sub) =>
          sub
            .where("ticket.reference ILIKE :search")
            .orWhere("ticket.subject ILIKE :search")
            .orWhere("customer.name ILIKE :search")
            .orWhere("customer.email ILIKE :search"),
        ),
        { search: `%${query.search}%` },
      );
    const [data, total] = await qb
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return {
      data,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }
  async historyForCustomer(customerUserId: string, excludeId: string) {
    return this.tickets
      .find({
        where: { customerUserId },
        order: { createdAt: "DESC" },
        take: 10,
      })
      .then((rows) => rows.filter((row) => row.id !== excludeId));
  }

  async getMessages(user: User, id: string) {
    const ticket = await this.get(id);
    this.assertAccess(user, ticket);
    return this.messages.find({
      where: { ticketId: id },
      order: { createdAt: "ASC" },
    });
  }
  async reply(user: User, id: string, dto: CreateSupportMessageDto) {
    const ticket = await this.get(id);
    this.assertAccess(user, ticket);
    if (ticket.status === SupportTicketStatus.CLOSED)
      throw new BadRequestException("Reopen this ticket before replying");
    const message = await this.messages.save(
      this.messages.create({ ticketId: id, senderUserId: user.id, ...dto }),
    );
    if (user.isAdmin) {
      await this.notifications.create(ticket.customerUserId, {
        type: "support.agent_replied",
        title: `Support replied to ${ticket.reference}`,
        body: dto.body.slice(0, 160),
        link: `/account/support/${id}`,
      });
    } else {
      if (ticket.status === SupportTicketStatus.WAITING_FOR_CUSTOMER) {
        ticket.status = SupportTicketStatus.OPEN;
        await this.tickets.save(ticket);
      }
      const recipients = ticket.assignedAgentUserId
        ? [ticket.assignedAgentUserId]
        : await this.adminIds();
      await this.notifications.createMany(recipients, {
        type: "admin.support_customer_replied",
        title: `Customer replied to ${ticket.reference}`,
        body: dto.body.slice(0, 160),
        link: `/admin/support/${id}`,
      });
    }
    return this.messages.findOneOrFail({ where: { id: message.id } });
  }
  async update(agent: User, id: string, dto: UpdateSupportTicketDto) {
    const ticket = await this.get(id);
    const previousAssigneeId = ticket.assignedAgentUserId;
    if (dto.assignedAgentUserId) {
      const assignee = await this.users.findOne({
        where: { id: dto.assignedAgentUserId },
      });
      if (!assignee?.isAdmin)
        throw new BadRequestException(
          "Tickets can only be assigned to an administrator",
        );
    }
    const statusChanged = dto.status && dto.status !== ticket.status;
    Object.assign(ticket, dto);
    if (dto.status === SupportTicketStatus.RESOLVED)
      ticket.resolvedAt = new Date();
    if (dto.status === SupportTicketStatus.CLOSED) ticket.closedAt = new Date();
    if (
      dto.status &&
      ![SupportTicketStatus.RESOLVED, SupportTicketStatus.CLOSED].includes(
        dto.status,
      )
    ) {
      ticket.resolvedAt = null;
      ticket.closedAt = null;
    }
    const saved = await this.tickets.save(ticket);
    if (
      dto.assignedAgentUserId &&
      dto.assignedAgentUserId !== agent.id &&
      dto.assignedAgentUserId !== previousAssigneeId
    ) {
      await this.notifications.create(dto.assignedAgentUserId, {
        type: "admin.support_ticket_assigned",
        title: `Support ticket ${ticket.reference} was assigned to you`,
        body: ticket.subject,
        link: `/admin/support/${id}`,
      });
    }
    if (statusChanged)
      await this.notifications.create(ticket.customerUserId, {
        type: "support.status_changed",
        title: `${ticket.reference} is now ${dto.status!.replaceAll("_", " ")}`,
        body: "Your support request status has changed.",
        link: `/account/support/${id}`,
      });
    return saved;
  }
  async confirmResolved(user: User, id: string, dto: RateSupportTicketDto) {
    const ticket = await this.get(id);
    if (ticket.customerUserId !== user.id) throw new ForbiddenException();
    if (ticket.status !== SupportTicketStatus.RESOLVED)
      throw new BadRequestException("Only resolved tickets can be confirmed");
    ticket.status = SupportTicketStatus.CLOSED;
    ticket.closedAt = new Date();
    ticket.rating = dto.rating;
    ticket.ratingComment = dto.comment;
    return this.tickets.save(ticket);
  }
  async rate(user: User, id: string, dto: RateSupportTicketDto) {
    const ticket = await this.get(id);
    if (ticket.customerUserId !== user.id) throw new ForbiddenException();
    if (
      ![SupportTicketStatus.RESOLVED, SupportTicketStatus.CLOSED].includes(
        ticket.status,
      )
    )
      throw new BadRequestException("Resolve the ticket before rating support");
    ticket.rating = dto.rating;
    ticket.ratingComment = dto.comment;
    return this.tickets.save(ticket);
  }
}
