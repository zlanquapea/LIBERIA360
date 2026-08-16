import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AdminAuditService } from "./admin-audit.service";
import { QueryAdminActionsDto } from "./dto/query-admin-actions.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../auth/guards/super-admin.guard";
import { toPublicUser } from "../users/user.serializer";
import { AdminAction } from "./entities/admin-action.entity";

function sanitize(entry: AdminAction) {
  return { ...entry, adminUser: toPublicUser(entry.adminUser) };
}

// Super-admin only, same reasoning as AdminTeamController: this is
// oversight *of* admins, not an ordinary admin capability.
@ApiTags("Admin Audit Log")
@Controller("admin/audit-log")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminAuditController {
  constructor(private readonly adminAuditService: AdminAuditService) {}

  @Get()
  async findAll(@Query() query: QueryAdminActionsDto) {
    const result = await this.adminAuditService.findAll(
      query.page ?? 1,
      query.limit ?? 20,
    );
    return { ...result, data: result.data.map(sanitize) };
  }
}
