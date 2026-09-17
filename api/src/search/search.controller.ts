import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SearchService } from "./search.service";
import { SuggestQueryDto } from "./dto/suggest-query.dto";

// Public, no auth guard — same visibility as GET /places, /businesses,
// /events findAll, and every result this returns is filtered to that same
// publicly-approved subset (see SearchService's own per-entity queries).
@ApiTags("Search")
@Controller("search")
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get("suggest")
  suggest(@Query() query: SuggestQueryDto) {
    return this.search.suggest(query.q ?? "");
  }
}
