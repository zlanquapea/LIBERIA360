import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { User } from "../users/entities/user.entity";
import {
  BoardTripDto,
  BookTripDto,
  HostingDto,
  ReviewTripPaymentDto,
  TripBookingNoteDto,
  TripPaymentDto,
} from "./dto/group-trips.dto";
import { GroupTripsService } from "./group-trips.service";

const uuid = new ParseUUIDPipe();

/** Organised group trips: hosting a trip, booking spots on it, paying,
 * and the organiser's desk. Every route needs a signed-in user — the
 * public trip page reads its hosting details from GET /itineraries/public/:id. */
@ApiTags("Group trips")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class GroupTripsController {
  constructor(private readonly groupTrips: GroupTripsService) {}

  @Put("itineraries/:id/hosting")
  saveHosting(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
    @Body() dto: HostingDto,
  ) {
    return this.groupTrips.saveHosting(u.id, id, dto);
  }

  @Get("itineraries/:id/hosting/desk")
  desk(@CurrentUser() u: User, @Param("id", uuid) id: string) {
    return this.groupTrips.desk(u.id, id);
  }

  @Post("itineraries/:id/bookings")
  book(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
    @Body() dto: BookTripDto,
  ) {
    return this.groupTrips.book(u.id, id, dto);
  }

  @Get("itineraries/:id/my-booking")
  myBooking(@CurrentUser() u: User, @Param("id", uuid) id: string) {
    return this.groupTrips.myBookingFor(u.id, id);
  }

  // "mine" comes before ":bookingId".
  @Get("trip-bookings/mine")
  mine(@CurrentUser() u: User) {
    return this.groupTrips.mine(u.id);
  }

  @Get("trip-bookings/:bookingId")
  get(@CurrentUser() u: User, @Param("bookingId", uuid) bookingId: string) {
    return this.groupTrips.get(u.id, bookingId);
  }

  @Post("trip-bookings/:bookingId/payments")
  pay(
    @CurrentUser() u: User,
    @Param("bookingId", uuid) bookingId: string,
    @Body() dto: TripPaymentDto,
  ) {
    return this.groupTrips.pay(u.id, bookingId, dto);
  }

  @Patch("trip-bookings/:bookingId/payments/:paymentId")
  reviewPayment(
    @CurrentUser() u: User,
    @Param("bookingId", uuid) bookingId: string,
    @Param("paymentId", uuid) paymentId: string,
    @Body() dto: ReviewTripPaymentDto,
  ) {
    return this.groupTrips.reviewPayment(
      u.id,
      bookingId,
      paymentId,
      dto.received,
    );
  }

  @Post("trip-bookings/:bookingId/confirm")
  confirm(
    @CurrentUser() u: User,
    @Param("bookingId", uuid) bookingId: string,
    @Body() dto: TripBookingNoteDto,
  ) {
    return this.groupTrips.confirm(u.id, bookingId, dto.note);
  }

  @Post("trip-bookings/:bookingId/decline")
  decline(
    @CurrentUser() u: User,
    @Param("bookingId", uuid) bookingId: string,
    @Body() dto: TripBookingNoteDto,
  ) {
    return this.groupTrips.decline(u.id, bookingId, dto.note);
  }

  @Post("trip-bookings/:bookingId/promote")
  promote(@CurrentUser() u: User, @Param("bookingId", uuid) bookingId: string) {
    return this.groupTrips.promote(u.id, bookingId);
  }

  @Post("trip-bookings/:bookingId/cancel")
  cancel(
    @CurrentUser() u: User,
    @Param("bookingId", uuid) bookingId: string,
    @Body() dto: TripBookingNoteDto,
  ) {
    return this.groupTrips.cancel(u.id, bookingId, dto.note);
  }

  @Post("trip-bookings/:bookingId/board")
  board(
    @CurrentUser() u: User,
    @Param("bookingId", uuid) bookingId: string,
    @Body() dto: BoardTripDto,
  ) {
    return this.groupTrips.board(u.id, bookingId, dto);
  }

  @Patch("trip-bookings/:bookingId/refunded")
  refunded(
    @CurrentUser() u: User,
    @Param("bookingId", uuid) bookingId: string,
  ) {
    return this.groupTrips.markRefunded(u.id, bookingId);
  }
}
