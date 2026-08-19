import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LoginActivity } from "./entities/login-activity.entity";
import { User } from "../users/entities/user.entity";
import { LoginActivityService } from "./login-activity.service";

// Exports the service only, not a controller — AuthModule imports this to
// record attempts, AdminModule imports it to expose them (behind
// SuperAdminGuard, via AdminSecurityController) — same shape as
// AdminAuditModule.
@Module({
  imports: [TypeOrmModule.forFeature([LoginActivity, User])],
  providers: [LoginActivityService],
  exports: [LoginActivityService],
})
export class SecurityModule {}
