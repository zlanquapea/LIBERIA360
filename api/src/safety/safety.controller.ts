import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import {
  ReviewSafetyReportDto,
  SafetyQueueDto,
  SafetyReportDto,
} from "./safety.dto";
import { SafetyService } from "./safety.service";

@Controller("safety")
@UseGuards(JwtAuthGuard)
export class SafetyController {
  constructor(private readonly service: SafetyService) {}
  @Get("blocks")
  @Header("Cache-Control", "no-store")
  blocks(@CurrentUser() user: User) {
    return this.service.listBlocks(user.id);
  }
  @Post("blocks/creator/:id")
  blockCreator(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.blockCreator(user.id, id);
  }
  @Post("blocks/:id")
  block(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.block(user.id, id);
  }
  @Delete("blocks/:id")
  unblock(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.unblock(user.id, id);
  }
  @Post("reports")
  report(@CurrentUser() user: User, @Body() dto: SafetyReportDto) {
    return this.service.report(user.id, dto);
  }
  @Get("reports")
  @UseGuards(AdminGuard)
  @Header("Cache-Control", "no-store")
  queue(@Query() query: SafetyQueueDto) {
    return this.service.queue(query.status ?? "open", query.page ?? 1);
  }
  @Patch("reports/:id")
  @UseGuards(AdminGuard)
  review(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReviewSafetyReportDto,
  ) {
    return this.service.review(user.id, id, dto.action);
  }
}
