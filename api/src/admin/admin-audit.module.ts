import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminAction } from "./entities/admin-action.entity";
import { AdminAuditService } from "./admin-audit.service";

// Its own module (not folded into AdminModule) so both AdminModule and
// SponsoredPlacementsModule — otherwise-unrelated feature modules that
// both need to record admin actions — can import it without a circular
// dependency between them.
@Module({
  imports: [TypeOrmModule.forFeature([AdminAction])],
  providers: [AdminAuditService],
  exports: [AdminAuditService],
})
export class AdminAuditModule {}
