import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { AdminService } from "./admin.service";
import { getRequestInfo } from "../common/request-info";
import { SetVerificationDto } from "./dto/set-verification.dto";
import { SetCreatorVerificationDto } from "./dto/set-creator-verification.dto";
import { SetBusinessReviewStatusDto } from "./dto/set-business-review-status.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";
import { SuperAdminGuard } from "../auth/guards/super-admin.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { toPublicUser } from "../users/user.serializer";
import { Business } from "../businesses/entities/business.entity";
import { Creator } from "../creators/entities/creator.entity";
import { Review } from "../reviews/entities/review.entity";
import { Event } from "../events/entities/event.entity";
import { FlaggedContent } from "./admin.service";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

function sanitizeBusiness(business: Business) {
  return {
    ...business,
    owner: business.owner ? toPublicUser(business.owner) : null,
  };
}

function sanitizeCreator(creator: Creator) {
  return { ...creator, user: creator.user ? toPublicUser(creator.user) : null };
}

function sanitizeReview(review: Review) {
  return { ...review, user: review.user ? toPublicUser(review.user) : null };
}

function sanitizeEvent(event: Event) {
  return {
    ...event,
    createdBy: event.createdBy ? toPublicUser(event.createdBy) : null,
  };
}

function sanitizeFlaggedContent(flagged: FlaggedContent) {
  return {
    ...flagged,
    review: flagged.review ? sanitizeReview(flagged.review) : null,
    event: flagged.event ? sanitizeEvent(flagged.event) : null,
    business: flagged.business ? sanitizeBusiness(flagged.business) : null,
  };
}

@ApiTags("Admin")
@Controller("admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Patch("places/:id/verification")
  setPlaceVerification(
    @CurrentUser() admin: User,
    @Param("id") id: string,
    @Body() dto: SetVerificationDto,
    @Req() req: Request,
  ) {
    return this.adminService.setPlaceVerification(
      admin.id,
      id,
      dto.status,
      getRequestInfo(req),
    );
  }

  @Patch("businesses/:id/verification")
  async setBusinessVerification(
    @CurrentUser() admin: User,
    @Param("id") id: string,
    @Body() dto: SetVerificationDto,
    @Req() req: Request,
  ) {
    return sanitizeBusiness(
      await this.adminService.setBusinessVerification(
        admin.id,
        id,
        dto.status,
        getRequestInfo(req),
      ),
    );
  }

  @Patch("businesses/:id/review-status")
  async setBusinessReviewStatus(
    @CurrentUser() admin: User,
    @Param("id") id: string,
    @Body() dto: SetBusinessReviewStatusDto,
    @Req() req: Request,
  ) {
    return sanitizeBusiness(
      await this.adminService.setBusinessReviewStatus(
        admin.id,
        id,
        dto.status,
        dto.reason,
        getRequestInfo(req),
      ),
    );
  }

  @Patch("creators/:id/verification")
  async setCreatorVerification(
    @CurrentUser() admin: User,
    @Param("id") id: string,
    @Body() dto: SetCreatorVerificationDto,
    @Req() req: Request,
  ) {
    return sanitizeCreator(
      await this.adminService.setCreatorVerification(
        admin.id,
        id,
        dto.status,
        getRequestInfo(req),
      ),
    );
  }

  @Get("moderation-queue")
  async getModerationQueue() {
    const queue = await this.adminService.getModerationQueue();
    return {
      pendingBusinesses: queue.pendingBusinesses.map(sanitizeBusiness),
      recentReviews: queue.recentReviews.map(sanitizeReview),
      possiblyClosedPlaces: queue.possiblyClosedPlaces,
      flaggedContent: queue.flaggedContent.map(sanitizeFlaggedContent),
    };
  }

  // Super-admin only (stacks with the class-level AdminGuard) — same
  // reasoning as Team & Access and the audit log: platform-wide growth
  // and business numbers are oversight for the team running LIBERIA360,
  // not something every admin needs on their dashboard.
  @Get("kpis")
  @UseGuards(SuperAdminGuard)
  getPlatformKpis() {
    return this.adminService.getPlatformKpis();
  }
}
