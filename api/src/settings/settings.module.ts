import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ApplicationSettings } from "./entities/application-settings.entity";
import { SettingsService } from "./settings.service";

// Exports the service only, not a controller — AdminModule exposes it
// behind SuperAdminGuard (see admin-settings.controller.ts), AdminModule
// and SecurityModule's consumers (AdminService, LoginActivityService)
// import this to read the current thresholds. Same shape as
// AdminAuditModule/SecurityModule.
@Module({
  imports: [TypeOrmModule.forFeature([ApplicationSettings])],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
