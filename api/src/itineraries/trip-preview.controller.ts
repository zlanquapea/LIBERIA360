import { Body, Controller, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ItinerariesService } from "./itineraries.service";
import { GenerateTripDto } from "./dto/generate-trip.dto";

// Deliberately its own controller, unguarded, rather than a route on
// ItinerariesController — that controller applies JwtAuthGuard at the
// class level, and this is the one itinerary endpoint a visitor with no
// account needs to reach (product review readout, Aug 22, 2026:
// "guest-first trip planning" — let someone see a real generated route
// before asking them to log in). Nothing here is persisted; see
// TripPreviewResponse's doc comment for how saving works afterward.
@ApiTags("Itineraries")
@Controller("itineraries")
export class TripPreviewController {
  constructor(private readonly itinerariesService: ItinerariesService) {}

  @Post("preview")
  previewTrip(@Body() dto: GenerateTripDto) {
    return this.itinerariesService.previewTrip(dto);
  }
}
