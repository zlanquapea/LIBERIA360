import { Controller, Get, Param, Query } from "@nestjs/common";
import { CountiesService } from "./counties.service";
import { QueryPlacesDto } from "../places/dto/query-places.dto";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("Counties")
@Controller("counties")
export class CountiesController {
  constructor(private readonly countiesService: CountiesService) {}

  @Get()
  findAll() {
    return this.countiesService.findAll();
  }

  @Get(":id/places")
  findPlaces(@Param("id") countySlug: string, @Query() query: QueryPlacesDto) {
    return this.countiesService.findPlaces(countySlug, query);
  }
}
