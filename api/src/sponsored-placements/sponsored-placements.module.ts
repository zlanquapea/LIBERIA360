import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SponsoredPlacement } from "./entities/sponsored-placement.entity";
import { Place } from "../places/entities/place.entity";
import { SponsoredPlacementsService } from "./sponsored-placements.service";
import { SponsoredPlacementsController } from "./sponsored-placements.controller";
import { AdminAuditModule } from "../admin/admin-audit.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([SponsoredPlacement, Place]),
    AdminAuditModule,
  ],
  controllers: [SponsoredPlacementsController],
  providers: [SponsoredPlacementsService],
})
export class SponsoredPlacementsModule {}
