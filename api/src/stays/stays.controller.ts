import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { User } from "../users/entities/user.entity";
import {
  CalendarQueryDto,
  CheckInDto,
  CreateReservationDto,
  FrontDeskQueryDto,
  ReservationMessageDto,
  ResendStayPaymentDto,
  RespondReservationDto,
  RoomBlockDto,
  RoomTypeDto,
  StayQueryDto,
  StaySettingsDto,
  VerifyStayPaymentDto,
  WalkInDto,
} from "./dto/stays.dto";
import { StaysService } from "./stays.service";

const uuid = new ParseUUIDPipe();

// Literal segments ("reservations", "manage") are declared before the
// public ":businessId" routes so they're never read as a business id.
@ApiTags("Stays")
@Controller("stays")
export class StaysController {
  constructor(private readonly stays: StaysService) {}

  // ── Guest ───────────────────────────────────────────────────────────

  @Post("reservations")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  reserve(@CurrentUser() u: User, @Body() dto: CreateReservationDto) {
    return this.stays.reserve(u.id, dto);
  }

  @Get("reservations/mine")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  mine(@CurrentUser() u: User) {
    return this.stays.mine(u.id);
  }

  @Get("reservations/:id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  get(@CurrentUser() u: User, @Param("id", uuid) id: string) {
    return this.stays.get(u.id, id);
  }

  @Post("reservations/:id/cancel")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  cancel(@CurrentUser() u: User, @Param("id", uuid) id: string) {
    return this.stays.cancel(u.id, id);
  }

  @Post("reservations/:id/payment")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  resendPayment(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
    @Body() dto: ResendStayPaymentDto,
  ) {
    return this.stays.resendPayment(u.id, id, dto.paymentReference);
  }

  @Get("reservations/:id/messages")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  messages(@CurrentUser() u: User, @Param("id", uuid) id: string) {
    return this.stays.listMessages(u.id, id);
  }

  @Post("reservations/:id/messages")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  sendMessage(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
    @Body() dto: ReservationMessageDto,
  ) {
    return this.stays.sendMessage(u.id, id, dto.body);
  }

  // ── Property: one booking ──────────────────────────────────────────

  @Post("reservations/:id/respond")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  respond(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
    @Body() dto: RespondReservationDto,
  ) {
    return this.stays.respond(u.id, id, dto.action, dto.message);
  }

  @Patch("reservations/:id/payment")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  verifyPayment(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
    @Body() dto: VerifyStayPaymentDto,
  ) {
    return this.stays.verifyPayment(u.id, id, dto.received);
  }

  @Post("reservations/:id/check-in")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  checkIn(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
    @Body() dto: CheckInDto,
  ) {
    return this.stays.checkIn(u.id, id, dto.roomNumbers);
  }

  @Post("reservations/:id/check-out")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  checkOut(@CurrentUser() u: User, @Param("id", uuid) id: string) {
    return this.stays.checkOut(u.id, id);
  }

  @Post("reservations/:id/no-show")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  noShow(@CurrentUser() u: User, @Param("id", uuid) id: string) {
    return this.stays.noShow(u.id, id);
  }

  @Patch("reservations/:id/refunded")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  refunded(@CurrentUser() u: User, @Param("id", uuid) id: string) {
    return this.stays.markRefunded(u.id, id);
  }

  // ── Property: setup and front desk ─────────────────────────────────

  @Get("manage/:businessId")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  manage(
    @CurrentUser() u: User,
    @Param("businessId", uuid) businessId: string,
  ) {
    return this.stays.manage(u.id, businessId);
  }

  @Put("manage/:businessId/settings")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  saveSettings(
    @CurrentUser() u: User,
    @Param("businessId", uuid) businessId: string,
    @Body() dto: StaySettingsDto,
  ) {
    return this.stays.saveSettings(u.id, businessId, dto);
  }

  @Post("manage/:businessId/room-types")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  createRoomType(
    @CurrentUser() u: User,
    @Param("businessId", uuid) businessId: string,
    @Body() dto: RoomTypeDto,
  ) {
    return this.stays.createRoomType(u.id, businessId, dto);
  }

  @Patch("manage/:businessId/room-types/:roomTypeId")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  updateRoomType(
    @CurrentUser() u: User,
    @Param("businessId", uuid) businessId: string,
    @Param("roomTypeId", uuid) roomTypeId: string,
    @Body() dto: RoomTypeDto,
  ) {
    return this.stays.updateRoomType(u.id, businessId, roomTypeId, dto);
  }

  @Delete("manage/:businessId/room-types/:roomTypeId")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  removeRoomType(
    @CurrentUser() u: User,
    @Param("businessId", uuid) businessId: string,
    @Param("roomTypeId", uuid) roomTypeId: string,
  ) {
    return this.stays.removeRoomType(u.id, businessId, roomTypeId);
  }

  @Get("manage/:businessId/calendar")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  calendar(
    @CurrentUser() u: User,
    @Param("businessId", uuid) businessId: string,
    @Query() q: CalendarQueryDto,
  ) {
    return this.stays.calendar(u.id, businessId, q.from, q.days ?? 14);
  }

  @Post("manage/:businessId/blocks")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  addBlock(
    @CurrentUser() u: User,
    @Param("businessId", uuid) businessId: string,
    @Body() dto: RoomBlockDto,
  ) {
    return this.stays.addBlock(u.id, businessId, dto);
  }

  @Delete("manage/:businessId/blocks/:blockId")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  removeBlock(
    @CurrentUser() u: User,
    @Param("businessId", uuid) businessId: string,
    @Param("blockId", uuid) blockId: string,
  ) {
    return this.stays.removeBlock(u.id, businessId, blockId);
  }

  @Get("manage/:businessId/front-desk")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  frontDesk(
    @CurrentUser() u: User,
    @Param("businessId", uuid) businessId: string,
    @Query() q: FrontDeskQueryDto,
  ) {
    return this.stays.frontDesk(u.id, businessId, q.date);
  }

  @Get("manage/:businessId/reservations")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  reservations(
    @CurrentUser() u: User,
    @Param("businessId", uuid) businessId: string,
  ) {
    return this.stays.reservationsFor(u.id, businessId);
  }

  @Post("manage/:businessId/walk-ins")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  walkIn(
    @CurrentUser() u: User,
    @Param("businessId", uuid) businessId: string,
    @Body() dto: WalkInDto,
  ) {
    return this.stays.walkIn(u.id, businessId, dto);
  }

  // ── Public ──────────────────────────────────────────────────────────

  @Get(":businessId")
  getStay(@Param("businessId", uuid) businessId: string) {
    return this.stays.getStay(businessId);
  }

  @Get(":businessId/availability")
  availability(
    @Param("businessId", uuid) businessId: string,
    @Query() q: StayQueryDto,
  ) {
    return this.stays.availability(businessId, q.checkIn, q.checkOut);
  }
}
