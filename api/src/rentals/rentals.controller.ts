import {
  Body,
  Controller,
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
  CreateRentalDto,
  FleetCalendarQueryDto,
  HandoverDto,
  RentalMessageDto,
  RentalSettingsDto,
  ResendRentalPaymentDto,
  RespondRentalDto,
  ReturnDto,
  VerifyRentalPaymentDto,
} from "./dto/rentals.dto";
import { RentalsService } from "./rentals.service";

const uuid = new ParseUUIDPipe();

// Literal segments ("terms", "mine", "fleet") come before ":id".
@ApiTags("Car rentals")
@Controller("rentals")
export class RentalsController {
  constructor(private readonly rentals: RentalsService) {}

  @Get("terms/:carListingId")
  terms(@Param("carListingId", uuid) carListingId: string) {
    return this.rentals.terms(carListingId);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  book(@CurrentUser() u: User, @Body() dto: CreateRentalDto) {
    return this.rentals.book(u.id, dto);
  }

  @Get("mine")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  mine(@CurrentUser() u: User) {
    return this.rentals.mine(u.id);
  }

  @Get("fleet/desk")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  desk(@CurrentUser() u: User) {
    return this.rentals.desk(u.id);
  }

  @Get("fleet/list")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser() u: User) {
    return this.rentals.list(u.id);
  }

  @Get("fleet/calendar")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  calendar(@CurrentUser() u: User, @Query() q: FleetCalendarQueryDto) {
    return this.rentals.calendar(u.id, q.from, q.days ?? 14);
  }

  @Get("fleet/settings")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  settings(@CurrentUser() u: User) {
    return this.rentals.getSettings(u.id);
  }

  @Put("fleet/settings")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  saveSettings(@CurrentUser() u: User, @Body() dto: RentalSettingsDto) {
    return this.rentals.saveSettings(u.id, dto);
  }

  @Get(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  get(@CurrentUser() u: User, @Param("id", uuid) id: string) {
    return this.rentals.get(u.id, id);
  }

  @Post(":id/cancel")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  cancel(@CurrentUser() u: User, @Param("id", uuid) id: string) {
    return this.rentals.cancel(u.id, id);
  }

  @Post(":id/payment")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  resendPayment(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
    @Body() dto: ResendRentalPaymentDto,
  ) {
    return this.rentals.resendPayment(u.id, id, dto.paymentReference);
  }

  @Patch(":id/payment")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  verifyPayment(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
    @Body() dto: VerifyRentalPaymentDto,
  ) {
    return this.rentals.verifyPayment(u.id, id, dto.received);
  }

  @Post(":id/respond")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  respond(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
    @Body() dto: RespondRentalDto,
  ) {
    return this.rentals.respond(u.id, id, dto.action, dto.message);
  }

  @Post(":id/handover")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  handover(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
    @Body() dto: HandoverDto,
  ) {
    return this.rentals.handover(u.id, id, dto);
  }

  @Post(":id/return")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  returnCar(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
    @Body() dto: ReturnDto,
  ) {
    return this.rentals.returnCar(u.id, id, dto);
  }

  @Post(":id/no-show")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  noShow(@CurrentUser() u: User, @Param("id", uuid) id: string) {
    return this.rentals.noShow(u.id, id);
  }

  @Patch(":id/refunded")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  refunded(@CurrentUser() u: User, @Param("id", uuid) id: string) {
    return this.rentals.markRefunded(u.id, id);
  }

  @Get(":id/messages")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  messages(@CurrentUser() u: User, @Param("id", uuid) id: string) {
    return this.rentals.listMessages(u.id, id);
  }

  @Post(":id/messages")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  sendMessage(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
    @Body() dto: RentalMessageDto,
  ) {
    return this.rentals.sendMessage(u.id, id, dto.body);
  }
}
