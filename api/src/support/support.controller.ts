import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AdminGuard } from "../auth/guards/admin.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { User } from "../users/entities/user.entity";
import { toPublicUser } from "../users/user.serializer";
import {
  CreateSupportMessageDto,
  CreateSupportTicketDto,
  QuerySupportTicketsDto,
  RateSupportTicketDto,
  UpdateSupportTicketDto,
} from "./dto/support.dto";
import { SupportService } from "./support.service";

const sanitize = (value: any): any =>
  Array.isArray(value)
    ? value.map(sanitize)
    : value && typeof value === "object"
      ? {
          ...value,
          ...(value.customer ? { customer: toPublicUser(value.customer) } : {}),
          ...(value.assignedAgent
            ? { assignedAgent: toPublicUser(value.assignedAgent) }
            : {}),
          ...(value.sender ? { sender: toPublicUser(value.sender) } : {}),
        }
      : value;
@ApiTags("Customer Support")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("support")
export class SupportController {
  constructor(private readonly support: SupportService) {}
  @Post("tickets") create(
    @CurrentUser() user: User,
    @Body() dto: CreateSupportTicketDto,
  ) {
    return this.support.create(user, dto).then(sanitize);
  }
  @Get("tickets/mine") mine(@CurrentUser() user: User) {
    return this.support.findMine(user.id).then(sanitize);
  }
  @Get("tickets/:id") one(@CurrentUser() user: User, @Param("id") id: string) {
    return this.support.findOne(user, id).then(sanitize);
  }
  @Get("tickets/:id/messages") messages(
    @CurrentUser() user: User,
    @Param("id") id: string,
  ) {
    return this.support.getMessages(user, id).then(sanitize);
  }
  @Post("tickets/:id/messages") reply(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: CreateSupportMessageDto,
  ) {
    return this.support.reply(user, id, dto).then(sanitize);
  }
  @Post("tickets/:id/confirm-resolved") confirm(
    @CurrentUser() user: User,
    @Param("id") id: string,
  ) {
    return this.support.confirmResolved(user, id).then(sanitize);
  }
  @Post("tickets/:id/rating") rate(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: RateSupportTicketDto,
  ) {
    return this.support.rate(user, id, dto).then(sanitize);
  }
}
@ApiTags("Support Management")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller("admin/support")
export class AdminSupportController {
  constructor(private readonly support: SupportService) {}
  @Get("tickets") all(@Query() query: QuerySupportTicketsDto) {
    return this.support.findAll(query).then(sanitize);
  }
  @Get("tickets/:id/history") async history(@Param("id") id: string) {
    const ticket = await this.support.findOne({ isAdmin: true } as User, id);
    return sanitize(
      await this.support.historyForCustomer(ticket.customerUserId, id),
    );
  }
  @Patch("tickets/:id") update(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: UpdateSupportTicketDto,
  ) {
    return this.support.update(user, id, dto).then(sanitize);
  }
}
