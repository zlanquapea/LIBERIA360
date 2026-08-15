import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SponsoredPlacement } from "./entities/sponsored-placement.entity";
import { Place } from "../places/entities/place.entity";
import { SponsoredPlacementsService } from "./sponsored-placements.service";
import { SponsoredPlacementsController } from "./sponsored-placements.controller";

@Module({
  imports: [TypeOrmModule.forFeature([SponsoredPlacement, Place])],
  controllers: [SponsoredPlacementsController],
  providers: [SponsoredPlacementsService],
})
export class SponsoredPlacementsModule {}
