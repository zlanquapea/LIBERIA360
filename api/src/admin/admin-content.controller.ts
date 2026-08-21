import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { AdminContentService } from "./admin-content.service";
import { getRequestInfo } from "../common/request-info";
import { CreatePlaceDto } from "./dto/create-place.dto";
import { UpdatePlaceDto } from "./dto/update-place.dto";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { CreateActivityDto } from "./dto/create-activity.dto";
import { UpdateActivityDto } from "./dto/update-activity.dto";
import { CreateBusinessAdminDto } from "./dto/create-business-admin.dto";
import { UpdateBusinessAdminDto } from "./dto/update-business-admin.dto";
import { UpdateEventDto } from "./dto/update-event.dto";
import { UpdateCountyDto } from "./dto/update-county.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";
import { SuperAdminGuard } from "../auth/guards/super-admin.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { toPublicUser } from "../users/user.serializer";
import { Business } from "../businesses/entities/business.entity";
import {
  BusinessReviewStatus,
  BusinessType,
} from "../businesses/entities/business.enums";
import { Event } from "../events/entities/event.entity";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

function sanitizeBusiness(business: Business) {
  return {
    ...business,
    owner: business.owner ? toPublicUser(business.owner) : null,
  };
}

function sanitizeEvent(event: Event) {
  return {
    ...event,
    createdBy: event.createdBy ? toPublicUser(event.createdBy) : null,
  };
}

// CRUD split between the two admin tiers: any admin can create/update the
// catalog (day-to-day content work, plus routine moderation deletes —
// deleteEvent/deleteReview below stay AdminGuard, unchanged, since that's
// the existing "Needs attention"/"Flagged content" workflow every admin
// already relies on). Deleting a *structural* catalog entity — a whole
// place, category, activity, business, or county, not a piece of
// moderated content — is reserved for a super admin, stacking
// @UseGuards(SuperAdminGuard) on top of this controller's own
// AdminGuard, same pattern as GET /admin/kpis in admin.controller.ts.
@ApiTags("Admin Content")
@Controller("admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminContentController {
  constructor(private readonly adminContentService: AdminContentService) {}

  @Post("places")
  createPlace(@Body() dto: CreatePlaceDto) {
    return this.adminContentService.createPlace(dto);
  }

  @Patch("places/:id")
  updatePlace(@Param("id") id: string, @Body() dto: UpdatePlaceDto) {
    return this.adminContentService.updatePlace(id, dto);
  }

  @Delete("places/:id")
  @UseGuards(SuperAdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  deletePlace(
    @CurrentUser() admin: User,
    @Param("id") id: string,
    @Req() req: Request,
  ) {
    return this.adminContentService.deletePlace(
      admin.id,
      id,
      getRequestInfo(req),
    );
  }

  @Post("categories")
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.adminContentService.createCategory(dto);
  }

  @Patch("categories/:id")
  updateCategory(@Param("id") id: string, @Body() dto: UpdateCategoryDto) {
    return this.adminContentService.updateCategory(id, dto);
  }

  @Delete("categories/:id")
  @UseGuards(SuperAdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCategory(
    @CurrentUser() admin: User,
    @Param("id") id: string,
    @Req() req: Request,
  ) {
    return this.adminContentService.deleteCategory(
      admin.id,
      id,
      getRequestInfo(req),
    );
  }

  @Post("activities")
  createActivity(@Body() dto: CreateActivityDto) {
    return this.adminContentService.createActivity(dto);
  }

  @Patch("activities/:id")
  updateActivity(@Param("id") id: string, @Body() dto: UpdateActivityDto) {
    return this.adminContentService.updateActivity(id, dto);
  }

  @Delete("activities/:id")
  @UseGuards(SuperAdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteActivity(
    @CurrentUser() admin: User,
    @Param("id") id: string,
    @Req() req: Request,
  ) {
    return this.adminContentService.deleteActivity(
      admin.id,
      id,
      getRequestInfo(req),
    );
  }

  // Every business regardless of review status (unlike the public
  // GET /businesses, which is approved-only) — the admin Business
  // Management list needs to see pending/rejected/suspended listings too.
  @Get("businesses")
  async listBusinesses(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
    @Query("reviewStatus") reviewStatus?: BusinessReviewStatus,
    @Query("type") type?: BusinessType,
    @Query("reportedOnly") reportedOnly?: string,
  ) {
    const result = await this.adminContentService.findBusinesses({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      reviewStatus,
      type,
      reportedOnly: reportedOnly === "true",
    });
    return { ...result, data: result.data.map(sanitizeBusiness) };
  }

  @Post("businesses")
  async createBusiness(@Body() dto: CreateBusinessAdminDto) {
    return sanitizeBusiness(await this.adminContentService.createBusiness(dto));
  }

  @Patch("businesses/:id")
  async updateBusiness(
    @Param("id") id: string,
    @Body() dto: UpdateBusinessAdminDto,
  ) {
    return sanitizeBusiness(
      await this.adminContentService.updateBusiness(id, dto),
    );
  }

  @Delete("businesses/:id")
  @UseGuards(SuperAdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteBusiness(
    @CurrentUser() admin: User,
    @Param("id") id: string,
    @Req() req: Request,
  ) {
    return this.adminContentService.deleteBusiness(
      admin.id,
      id,
      getRequestInfo(req),
    );
  }

  @Patch("events/:id")
  async updateEvent(@Param("id") id: string, @Body() dto: UpdateEventDto) {
    return sanitizeEvent(await this.adminContentService.updateEvent(id, dto));
  }

  @Delete("events/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteEvent(
    @CurrentUser() admin: User,
    @Param("id") id: string,
    @Req() req: Request,
  ) {
    return this.adminContentService.deleteEvent(
      admin.id,
      id,
      getRequestInfo(req),
    );
  }

  @Delete("reviews/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteReview(
    @CurrentUser() admin: User,
    @Param("id") id: string,
    @Req() req: Request,
  ) {
    return this.adminContentService.deleteReview(
      admin.id,
      id,
      getRequestInfo(req),
    );
  }

  @Patch("counties/:id")
  updateCounty(@Param("id") id: string, @Body() dto: UpdateCountyDto) {
    return this.adminContentService.updateCounty(id, dto);
  }

  @Delete("counties/:id")
  @UseGuards(SuperAdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCounty(
    @CurrentUser() admin: User,
    @Param("id") id: string,
    @Req() req: Request,
  ) {
    return this.adminContentService.deleteCounty(
      admin.id,
      id,
      getRequestInfo(req),
    );
  }
}
