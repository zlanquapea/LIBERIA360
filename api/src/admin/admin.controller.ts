import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { AdminService } from "./admin.service";
import { getRequestInfo } from "../common/request-info";
import { SetVerificationDto } from "./dto/set-verification.dto";
import { SetCreatorVerificationDto } from "./dto/set-creator-verification.dto";
import { SetBusinessReviewStatusDto } from "./dto/set-business-review-status.dto";
import { SetPlaceReviewStatusDto } from "./dto/set-place-review-status.dto";
import { BulkSetPlaceReviewStatusDto } from "./dto/bulk-set-place-review-status.dto";
import { BulkSetBusinessReviewStatusDto } from "./dto/bulk-set-business-review-status.dto";
import { SetBusinessContentReviewStatusDto } from "../business-content/dto/set-business-content-review-status.dto";
import { BulkSetBusinessContentReviewStatusDto } from "../business-content/dto/bulk-set-business-content-review-status.dto";
import { SetAdvertisementReviewStatusDto } from "./dto/set-advertisement-review-status.dto";
import { SetEventReviewStatusDto } from "./dto/set-event-review-status.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";
import { SuperAdminGuard } from "../auth/guards/super-admin.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { toPublicUser } from "../users/user.serializer";
import { Place } from "../places/entities/place.entity";
import { Business } from "../businesses/entities/business.entity";
import { Creator } from "../creators/entities/creator.entity";
import { Review } from "../reviews/entities/review.entity";
import { Event } from "../events/entities/event.entity";
import { BusinessContent } from "../business-content/entities/business-content.entity";
import { Advertisement } from "../advertisements/entities/advertisement.entity";
import { FlaggedContent } from "./admin.service";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

function sanitizePlace(place: Place) {
  return {
    ...place,
    owner: place.owner ? toPublicUser(place.owner) : null,
  };
}

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

function sanitizeBusinessContent(content: BusinessContent) {
  return {
    ...content,
    business: content.business ? sanitizeBusiness(content.business) : null,
  };
}

function sanitizeAdvertisement(ad: Advertisement) {
  return { ...ad, owner: ad.owner ? toPublicUser(ad.owner) : null };
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

  @Patch("places/:id/review-status")
  async setPlaceReviewStatus(
    @CurrentUser() admin: User,
    @Param("id") id: string,
    @Body() dto: SetPlaceReviewStatusDto,
    @Req() req: Request,
  ) {
    return sanitizePlace(
      await this.adminService.setPlaceReviewStatus(
        admin.id,
        id,
        dto.status,
        dto.reason,
        getRequestInfo(req),
      ),
    );
  }

  @Post("places/bulk-review-status")
  async bulkSetPlaceReviewStatus(
    @CurrentUser() admin: User,
    @Body() dto: BulkSetPlaceReviewStatusDto,
    @Req() req: Request,
  ) {
    return this.adminService.bulkSetPlaceReviewStatus(
      admin.id,
      dto.ids,
      dto.status,
      dto.reason,
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

  @Post("businesses/bulk-review-status")
  async bulkSetBusinessReviewStatus(
    @CurrentUser() admin: User,
    @Body() dto: BulkSetBusinessReviewStatusDto,
    @Req() req: Request,
  ) {
    return this.adminService.bulkSetBusinessReviewStatus(
      admin.id,
      dto.ids,
      dto.status,
      dto.reason,
      getRequestInfo(req),
    );
  }

  @Patch("business-content/:id/review-status")
  async setBusinessContentReviewStatus(
    @CurrentUser() admin: User,
    @Param("id") id: string,
    @Body() dto: SetBusinessContentReviewStatusDto,
    @Req() req: Request,
  ) {
    return sanitizeBusinessContent(
      await this.adminService.setBusinessContentReviewStatus(
        admin.id,
        id,
        dto.status,
        dto.reason,
        getRequestInfo(req),
      ),
    );
  }

  @Post("business-content/bulk-review-status")
  async bulkSetBusinessContentReviewStatus(
    @CurrentUser() admin: User,
    @Body() dto: BulkSetBusinessContentReviewStatusDto,
    @Req() req: Request,
  ) {
    return this.adminService.bulkSetBusinessContentReviewStatus(
      admin.id,
      dto.ids,
      dto.status,
      dto.reason,
      getRequestInfo(req),
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
      pendingPlaces: queue.pendingPlaces.map(sanitizePlace),
      recentReviews: queue.recentReviews.map(sanitizeReview),
      possiblyClosedPlaces: queue.possiblyClosedPlaces,
      flaggedContent: queue.flaggedContent.map(sanitizeFlaggedContent),
      pendingBusinessContent: queue.pendingBusinessContent.map(
        sanitizeBusinessContent,
      ),
      pendingAdvertisements: queue.pendingAdvertisements.map(
        sanitizeAdvertisement,
      ),
      pendingEvents: queue.pendingEvents.map(sanitizeEvent),
    };
  }

  // Every event regardless of status — the admin events management table,
  // unlike the public GET /events (approved-only). Mirrors
  // GET /admin/advertisements.
  @Get("events")
  async findAllEvents() {
    const events = await this.adminService.findAllEvents();
    return events.map(sanitizeEvent);
  }

  @Patch("events/:id/review-status")
  async setEventReviewStatus(
    @CurrentUser() admin: User,
    @Param("id") id: string,
    @Body() dto: SetEventReviewStatusDto,
    @Req() req: Request,
  ) {
    return sanitizeEvent(
      await this.adminService.setEventReviewStatus(
        admin.id,
        id,
        dto.status,
        dto.reason,
        getRequestInfo(req),
      ),
    );
  }

  // Every advertisement, any status — an admin's own dedicated queue
  // (distinct from moderation-queue's "SUBMITTED_FOR_REVIEW only" slice)
  // for reviewing/suspending an already-approved ad too.
  @Get("advertisements")
  async findAllAdvertisements() {
    const ads = await this.adminService.findAllAdvertisements();
    return ads.map(sanitizeAdvertisement);
  }

  @Patch("advertisements/:id/review-status")
  async setAdvertisementReviewStatus(
    @CurrentUser() admin: User,
    @Param("id") id: string,
    @Body() dto: SetAdvertisementReviewStatusDto,
    @Req() req: Request,
  ) {
    return sanitizeAdvertisement(
      await this.adminService.setAdvertisementReviewStatus(
        admin.id,
        id,
        dto.status,
        dto.reason,
        getRequestInfo(req),
      ),
    );
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
