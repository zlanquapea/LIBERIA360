import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Business } from "./entities/business.entity";
import { Place } from "../places/entities/place.entity";
import { BusinessesService } from "./businesses.service";
import { BusinessesController } from "./businesses.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Business, Place])],
  controllers: [BusinessesController],
  providers: [BusinessesService],
  exports: [BusinessesService],
})
export class BusinessesModule {}
