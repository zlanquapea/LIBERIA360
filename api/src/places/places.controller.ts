import { Controller, Get, Param, Query } from "@nestjs/common";
import { PlacesService } from "./places.service";
import { QueryPlacesDto } from "./dto/query-places.dto";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("Places")
@Controller("places")
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get()
  findAll(@Query() query: QueryPlacesDto) {
    return this.placesService.findAll(query);
  }

  @Get(":slug")
  findOne(@Param("slug") slug: string) {
    return this.placesService.findBySlug(slug);
  }
}
