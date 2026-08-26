import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LoginActivity } from "./entities/login-activity.entity";
import { User } from "../users/entities/user.entity";
import { LoginActivityService } from "./login-activity.service";
import { MailModule } from "../mail/mail.module";
import { SettingsModule } from "../settings/settings.module";
import { NotificationsModule } from "../notifications/notifications.module";

// Exports the service only, not a controller — AuthModule imports this to
// record attempts, AdminModule imports it to expose them (behind
// SuperAdminGuard, via AdminSecurityController) — same shape as
// AdminAuditModule. MailModule is imported so a failed-login spike can
// email every super admin directly (see LoginActivityService.record);
// SettingsModule so those alert thresholds come from Settings >
// Application instead of a hardcoded constant; NotificationsModule so the
// same alert also lands as an in-app notification. ConfigService needs no
// import since ConfigModule is registered isGlobal: true in app.module.ts.
@Module({
  imports: [
    TypeOrmModule.forFeature([LoginActivity, User]),
    MailModule,
    SettingsModule,
    NotificationsModule,
  ],
  providers: [LoginActivityService],
  exports: [LoginActivityService],
})
export class SecurityModule {}
