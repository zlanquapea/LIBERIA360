import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { LoginActivityService } from "../security/login-activity.service";
import { AuthService } from "../auth/auth.service";
import { AdminAuditService } from "./admin-audit.service";
import { QueryLoginActivityDto } from "./dto/query-login-activity.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../auth/guards/super-admin.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { toPublicUser } from "../users/user.serializer";
import { getRequestInfo } from "../common/request-info";
import { LoginActivity } from "../security/entities/login-activity.entity";

function sanitize(entry: LoginActivity) {
  return { ...entry, user: entry.user ? toPublicUser(entry.user) : null };
}

// Super-admin only, same reasoning as AdminAuditController/AdminTeamController
// — sign-in oversight and forced session revocation are platform-security
// concerns for the team running LIBERIA360, not an ordinary admin capability.
@ApiTags("Admin Security")
@Controller("admin/security")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminSecurityController {
  constructor(
    private readonly loginActivityService: LoginActivityService,
    private readonly authService: AuthService,
    private readonly adminAuditService: AdminAuditService,
  ) {}

  @Get("login-activity")
  async findLoginActivity(@Query() query: QueryLoginActivityDto) {
    const result = await this.loginActivityService.findAll(
      query.page ?? 1,
      query.limit ?? 20,
      query.onlyFailed,
    );
    return { ...result, data: result.data.map(sanitize) };
  }

  @Get("overview")
  getOverview() {
    return this.loginActivityService.getOverview();
  }

  // Ends every active session on the target account immediately — a
  // compromised account, a just-demoted admin, or any account a super
  // admin needs signed out right now. Doesn't require the target's
  // password (unlike the self-service POST /auth/logout-all), so this is
  // itself audit-logged like any other sensitive admin action.
  @Post("users/:id/revoke-sessions")
  @HttpCode(HttpStatus.OK)
  async revokeSessions(
    @CurrentUser() admin: User,
    @Param("id") id: string,
    @Req() req: Request,
  ) {
    const updated = await this.authService.revokeSessions(id);
    await this.adminAuditService.log(
      admin.id,
      "user.sessions_revoked",
      "user",
      id,
      undefined,
      getRequestInfo(req),
    );
    return toPublicUser(updated);
  }
}
