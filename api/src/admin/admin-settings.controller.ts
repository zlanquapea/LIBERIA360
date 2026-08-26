import { Body, Controller, Get, Patch, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { SettingsService } from "../settings/settings.service";
import { UpdateApplicationSettingsDto } from "../settings/dto/update-application-settings.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../auth/guards/super-admin.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { AdminAuditService } from "./admin-audit.service";
import { getRequestInfo } from "../common/request-info";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

// Settings > Application — the first of the five placeholder Settings
// sections (see web/src/app/admin/settings/[section]/page.tsx) backed by
// a real store instead of "not built yet." Super admin only, same tier
// as Team & Access and the audit log — these thresholds affect what
// every admin sees in the moderation queue and who gets paged on a
// brute-force spike.
@ApiTags("Admin Settings")
@Controller("admin/settings")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminSettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly adminAuditService: AdminAuditService,
  ) {}

  @Get("application")
  getApplicationSettings() {
    return this.settingsService.getApplicationSettings();
  }

  @Patch("application")
  async updateApplicationSettings(
    @CurrentUser() admin: User,
    @Body() dto: UpdateApplicationSettingsDto,
    @Req() req: Request,
  ) {
    const updated = await this.settingsService.updateApplicationSettings(
      dto,
      admin.id,
    );
    await this.adminAuditService.log(
      admin.id,
      "settings.application_updated",
      "application_settings",
      "1",
      { ...dto },
      getRequestInfo(req),
    );
    return updated;
  }
}
