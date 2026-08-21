import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { BookingsService } from "./bookings.service";
import { CreateBookingDto } from "./dto/create-booking.dto";
import { RespondBookingDto } from "./dto/respond-booking.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { toPublicUser } from "../users/user.serializer";
import { Booking } from "./entities/booking.entity";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

// Nested user objects (guest, business.owner, creator.user) come through
// eager relations as raw entities — strip passwordHash before anything
// leaves the API, same pattern as reviews/businesses/events/creators.
function sanitize(booking: Booking) {
  return {
    ...booking,
    guest: booking.guest ? toPublicUser(booking.guest) : null,
    business: booking.business
      ? {
          ...booking.business,
          owner: booking.business.owner
            ? toPublicUser(booking.business.owner)
            : null,
        }
      : null,
    creator: booking.creator
      ? {
          ...booking.creator,
          user: booking.creator.user
            ? toPublicUser(booking.creator.user)
            : null,
        }
      : null,
  };
}

@ApiTags("Bookings")
@Controller("bookings")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateBookingDto) {
    return sanitize(await this.bookingsService.create(user.id, dto));
  }

  @Get("mine")
  async findMine(@CurrentUser() user: User) {
    const bookings = await this.bookingsService.findMine(user.id);
    return bookings.map(sanitize);
  }

  @Get("business/:businessId")
  async findForBusiness(
    @CurrentUser() user: User,
    @Param("businessId") businessId: string,
  ) {
    const bookings = await this.bookingsService.findForBusiness(
      user.id,
      businessId,
    );
    return bookings.map(sanitize);
  }

  @Get("creator/:creatorId")
  async findForCreator(
    @CurrentUser() user: User,
    @Param("creatorId") creatorId: string,
  ) {
    const bookings = await this.bookingsService.findForCreator(
      user.id,
      creatorId,
    );
    return bookings.map(sanitize);
  }

  @Patch(":id/respond")
  async respond(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: RespondBookingDto,
  ) {
    return sanitize(await this.bookingsService.respond(user.id, id, dto));
  }

  @Patch(":id/cancel")
  async cancel(@CurrentUser() user: User, @Param("id") id: string) {
    return sanitize(await this.bookingsService.cancel(user.id, id));
  }
}
