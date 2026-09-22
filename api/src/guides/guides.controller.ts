import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { GuidesService } from "./guides.service";
import {
  ApplyGuideDto,
  CreateExperienceDto,
  CreateGuideBookingDto,
  CreateGuideReviewDto,
  QueryGuidesDto,
  RespondGuideBookingDto,
  SetGuideVerificationDto,
} from "./guides.dto";

@ApiTags("Trip Guides & Hosts")
@Controller()
export class GuidesController {
  constructor(private readonly guidesService: GuidesService) {}

  @Get("guides")
  listGuides(@Query() query: QueryGuidesDto) {
    return this.guidesService.listGuides(query);
  }

  @Get("guides/:slug")
  findGuide(@Param("slug") slug: string) {
    return this.guidesService.findGuide(slug);
  }

  @Get("experiences")
  listExperiences(
    @Query() query: { search?: string; category?: string; county?: string },
  ) {
    return this.guidesService.listExperiences(query);
  }

  @Get("experiences/:id")
  findExperience(@Param("id") id: string) {
    return this.guidesService.findExperience(id);
  }

  @Post("guides/apply")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  apply(@CurrentUser() user: User, @Body() dto: ApplyGuideDto) {
    return this.guidesService.apply(user.id, dto);
  }

  @Post("guides/me/verification-document")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor("document", { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  uploadVerificationDocument(
    @CurrentUser() user: User,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string },
  ) {
    if (!file)
      throw new BadRequestException("A verification document is required");
    return this.guidesService.uploadVerificationDocument(user.id, file);
  }

  @Post("experiences")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  createExperience(
    @CurrentUser() user: User,
    @Body() dto: CreateExperienceDto,
  ) {
    return this.guidesService.createExperience(user.id, dto);
  }

  @Post("experiences/:id/book")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  createBooking(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: CreateGuideBookingDto,
  ) {
    return this.guidesService.createBooking(user.id, id, dto);
  }

  @Get("guide-bookings/mine")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  findMine(@CurrentUser() user: User) {
    return this.guidesService.findMine(user.id);
  }

  @Get("guide-bookings/incoming")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  findIncoming(@CurrentUser() user: User) {
    return this.guidesService.findIncoming(user.id);
  }

  @Patch("guide-bookings/:id/respond")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  respond(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: RespondGuideBookingDto,
  ) {
    return this.guidesService.respond(user.id, id, dto);
  }

  @Post("guide-bookings/:id/review")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  review(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: CreateGuideReviewDto,
  ) {
    return this.guidesService.review(user.id, id, dto);
  }

  @Get("admin/guides/pending")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  listPendingApplications() {
    return this.guidesService.listPendingApplications();
  }

  @Patch("admin/guides/:id/verification")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  setVerification(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: SetGuideVerificationDto,
  ) {
    return this.guidesService.setVerification(user.id, id, dto);
  }
}
