import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { County } from "./entities/county.entity";
import { CountiesService } from "./counties.service";
import { CountiesController } from "./counties.controller";
import { PlacesModule } from "../places/places.module";

@Module({
  imports: [TypeOrmModule.forFeature([County]), PlacesModule],
  controllers: [CountiesController],
  providers: [CountiesService],
  exports: [CountiesService],
})
export class CountiesModule {}
