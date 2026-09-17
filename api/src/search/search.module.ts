import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Place } from "../places/entities/place.entity";
import { Business } from "../businesses/entities/business.entity";
import { Event } from "../events/entities/event.entity";
import { Creator } from "../creators/entities/creator.entity";
import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";

@Module({
  imports: [TypeOrmModule.forFeature([Place, Business, Event, Creator])],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
