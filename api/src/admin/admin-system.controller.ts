import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AdminSystemService } from "./admin-system.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../auth/guards/super-admin.guard";

// Super-admin only — same tier as Team/Audit/Security: this is platform
// operations oversight, not an ordinary admin capability.
@ApiTags("Admin System")
@Controller("admin/system")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminSystemController {
  constructor(private readonly adminSystemService: AdminSystemService) {}

  @Get("status")
  getStatus() {
    return this.adminSystemService.getStatus();
  }
}
