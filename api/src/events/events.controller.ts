import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { EventsService } from "./events.service";
import { CreateEventDto } from "./dto/create-event.dto";
import { UpdateEventDto } from "./dto/update-event.dto";
import { QueryEventsDto } from "./dto/query-events.dto";
import { SetEventRsvpDto } from "./dto/set-event-rsvp.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { toPublicUser } from "../users/user.serializer";
import { Event } from "./entities/event.entity";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

function sanitize(event: Event) {
  return {
    ...event,
    createdBy: event.createdBy ? toPublicUser(event.createdBy) : null,
  };
}

@ApiTags("Events")
@Controller("events")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: User, @Body() dto: CreateEventDto) {
    return sanitize(await this.eventsService.create(user, dto));
  }

  @Get()
  async findAll(@Query() query: QueryEventsDto) {
    const result = await this.eventsService.findAll(query);
    return { ...result, data: result.data.map(sanitize) };
  }

  // Must come before GET :id — otherwise Nest matches "mine" as an :id.
  @Get("mine")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async findMine(@CurrentUser() user: User) {
    return (await this.eventsService.findMine(user.id)).map(sanitize);
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return sanitize(await this.eventsService.findOne(id));
  }

  @Patch(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async update(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: UpdateEventDto,
  ) {
    return sanitize(await this.eventsService.update(user, id, dto));
  }

  @Delete(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async remove(@CurrentUser() user: User, @Param("id") id: string) {
    await this.eventsService.remove(user, id);
  }

  @Put(":id/rsvp")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async setRsvp(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: SetEventRsvpDto,
  ) {
    return this.eventsService.setRsvp(user.id, id, dto.status);
  }

  @Delete(":id/rsvp")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async removeRsvp(@CurrentUser() user: User, @Param("id") id: string) {
    return this.eventsService.removeRsvp(user.id, id);
  }

  // The viewer's own RSVP status — a separate authenticated route rather
  // than a field on findOne's response, since findOne has no auth guard
  // and so no reliable viewer identity to compute it against. The event
  // detail page fetches this client-side (see EventRsvpButtons) once a
  // token is available.
  @Get(":id/rsvp")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async getMyRsvp(@CurrentUser() user: User, @Param("id") id: string) {
    return { status: await this.eventsService.getViewerRsvp(user.id, id) };
  }

  @Get(":id/attendees")
  async getAttendees(@Param("id") id: string) {
    return this.eventsService.getGoingAttendees(id);
  }
}
