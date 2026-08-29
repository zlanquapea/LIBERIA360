import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";
import { AdminAssistantReviewService } from "./admin-assistant-review.service";

@ApiTags("Admin Assistant Review")
@ApiBearerAuth()
@Controller("admin/assistant-review")
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminAssistantReviewController {
  constructor(private readonly reviewService: AdminAssistantReviewService) {}

  @Get()
  @ApiOperation({
    summary: "Review assistant feedback and unanswered questions",
  })
  getQueue(@Query("limit") limit?: string) {
    return this.reviewService.getQueue(limit ? Number(limit) : undefined);
  }
}
