import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { EventsService } from "./events.service";
import { CreateEventDto } from "./dto/create-event.dto";
import { QueryEventsDto } from "./dto/query-events.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { toPublicUser } from "../users/user.serializer";
import { Event } from "./entities/event.entity";

function sanitize(event: Event) {
  return {
    ...event,
    createdBy: event.createdBy ? toPublicUser(event.createdBy) : null,
  };
}

@Controller("events")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: User, @Body() dto: CreateEventDto) {
    return sanitize(await this.eventsService.create(user, dto));
  }

  @Get()
  async findAll(@Query() query: QueryEventsDto) {
    const result = await this.eventsService.findAll(query);
    return { ...result, data: result.data.map(sanitize) };
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return sanitize(await this.eventsService.findOne(id));
  }
}
