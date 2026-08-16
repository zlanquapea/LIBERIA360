import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { SetVerificationDto } from "./dto/set-verification.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { toPublicUser } from "../users/user.serializer";
import { Business } from "../businesses/entities/business.entity";
import { Review } from "../reviews/entities/review.entity";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

function sanitizeBusiness(business: Business) {
  return {
    ...business,
    owner: business.owner ? toPublicUser(business.owner) : null,
  };
}

function sanitizeReview(review: Review) {
  return { ...review, user: review.user ? toPublicUser(review.user) : null };
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
  ) {
    return this.adminService.setPlaceVerification(admin.id, id, dto.status);
  }

  @Patch("businesses/:id/verification")
  async setBusinessVerification(
    @CurrentUser() admin: User,
    @Param("id") id: string,
    @Body() dto: SetVerificationDto,
  ) {
    return sanitizeBusiness(
      await this.adminService.setBusinessVerification(admin.id, id, dto.status),
    );
  }

  @Get("moderation-queue")
  async getModerationQueue() {
    const queue = await this.adminService.getModerationQueue();
    return {
      pendingBusinesses: queue.pendingBusinesses.map(sanitizeBusiness),
      recentReviews: queue.recentReviews.map(sanitizeReview),
      possiblyClosedPlaces: queue.possiblyClosedPlaces,
    };
  }
}
