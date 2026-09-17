import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Place } from "../places/entities/place.entity";
import { PlaceReviewStatus } from "../places/entities/place.enums";
import { Business } from "../businesses/entities/business.entity";
import { BusinessReviewStatus } from "../businesses/entities/business.enums";
import { Event } from "../events/entities/event.entity";
import { EventReviewStatus } from "../events/entities/event.enums";
import { Creator } from "../creators/entities/creator.entity";
import { PlaceType } from "../places/entities/place.enums";
import { BusinessType } from "../businesses/entities/business.enums";
import { EventCategory } from "../events/entities/event.enums";
import { CreatorCategory } from "../creators/entities/creator.enums";

// Mirrored by PlaceSearchSuggestion/BusinessSearchSuggestion/
// EventSearchSuggestion/CreatorSearchSuggestion/SearchSuggestResponse in
// packages/shared-types (the frontend's copy of this wire shape) — same
// convention as every other entity here (Place, Business, ...): the API
// never imports shared-types itself, it just has to stay in sync with it.
export interface PlaceSearchSuggestion {
  kind: "place";
  id: string;
  slug: string;
  name: string;
  image: string | null;
  type: PlaceType;
  city: string;
  county: { name: string };
}

export interface BusinessSearchSuggestion {
  kind: "business";
  id: string;
  slug: string;
  name: string;
  image: string | null;
  type: BusinessType;
  city: string;
  county: { name: string };
}

export interface EventSearchSuggestion {
  kind: "event";
  id: string;
  name: string;
  image: string | null;
  category: EventCategory;
  startDate: string;
  endDate: string | null;
  locationText: string | null;
  place: { name: string } | null;
  county: { name: string };
}

export interface CreatorSearchSuggestion {
  kind: "creator";
  id: string;
  username: string;
  name: string;
  image: string | null;
  category: CreatorCategory;
  county: { name: string } | null;
}

export interface SearchSuggestResponse {
  query: string;
  places: PlaceSearchSuggestion[];
  businesses: BusinessSearchSuggestion[];
  events: EventSearchSuggestion[];
  creators: CreatorSearchSuggestion[];
}

// Below this, "suggestions" would just be noise (a single letter matches
// half the catalog) — matches DestinationAutocomplete's own threshold on
// the frontend, kept here too since this is a public endpoint other
// clients could call directly.
const MIN_QUERY_LENGTH = 2;

// Per-type cap on a dropdown that has to show four content types at once
// without turning into a full results page — GET /places?q= (the actual
// Search Results screen) has no such limit.
const SUGGEST_LIMIT = 5;

// ILIKE, not the Postgres full-text search GET /places?q= uses
// (websearch_to_tsquery, see SEARCH_VECTOR_SQL in places.service.ts) —
// full-text search matches whole, already-typed words, so "rob" typed
// toward "Robertsport" matches nothing until the word is finished. A live
// typeahead needs to match mid-word, which only a prefix/substring
// comparison does. Fine at this catalog's size (no trigram index; see
// api/README.md's existing "no PostGIS at this scale" tradeoff for the
// same reasoning applied here).
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Place)
    private readonly placeRepo: Repository<Place>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(Creator)
    private readonly creatorRepo: Repository<Creator>,
  ) {}

  async suggest(rawQuery: string): Promise<SearchSuggestResponse> {
    const query = (rawQuery ?? "").trim();
    if (query.length < MIN_QUERY_LENGTH) {
      return { query, places: [], businesses: [], events: [], creators: [] };
    }

    const [places, businesses, events, creators] = await Promise.all([
      this.suggestPlaces(query),
      this.suggestBusinesses(query),
      this.suggestEvents(query),
      this.suggestCreators(query),
    ]);

    return { query, places, businesses, events, creators };
  }

  private async suggestPlaces(query: string): Promise<PlaceSearchSuggestion[]> {
    const pattern = escapeLikePattern(query);
    const rows = await this.placeRepo
      .createQueryBuilder("place")
      .leftJoinAndSelect("place.county", "county")
      .where("place.reviewStatus = :status", {
        status: PlaceReviewStatus.APPROVED,
      })
      .andWhere("place.name ILIKE :contains", { contains: `%${pattern}%` })
      // A name that *starts with* the query ("Robertsport" for "rob")
      // reads as a much better match than one that merely contains it
      // ("Old Robert's Guesthouse") — ranked first, then by the same
      // featured/rating priority the catalog's default browse order uses.
      .addSelect(
        "(CASE WHEN place.name ILIKE :starts THEN 0 ELSE 1 END)",
        "prefix_rank",
      )
      .setParameter("starts", `${pattern}%`)
      .orderBy("prefix_rank", "ASC")
      .addOrderBy("place.featured", "DESC")
      .addOrderBy("place.rating", "DESC")
      .take(SUGGEST_LIMIT)
      .getMany();

    return rows.map((place) => ({
      kind: "place",
      id: place.id,
      slug: place.slug,
      name: place.name,
      image: place.images[0] ?? null,
      type: place.type,
      city: place.city,
      county: { name: place.county.name },
    }));
  }

  private async suggestBusinesses(
    query: string,
  ): Promise<BusinessSearchSuggestion[]> {
    const pattern = escapeLikePattern(query);
    const rows = await this.businessRepo
      .createQueryBuilder("business")
      .leftJoinAndSelect("business.linkedPlace", "linkedPlace")
      .leftJoinAndSelect("linkedPlace.county", "linkedPlaceCounty")
      .where("business.reviewStatus = :status", {
        status: BusinessReviewStatus.APPROVED,
      })
      .andWhere("business.name ILIKE :contains", { contains: `%${pattern}%` })
      .addSelect(
        "(CASE WHEN business.name ILIKE :starts THEN 0 ELSE 1 END)",
        "prefix_rank",
      )
      .setParameter("starts", `${pattern}%`)
      .orderBy("prefix_rank", "ASC")
      .addOrderBy("business.name", "ASC")
      .take(SUGGEST_LIMIT)
      .getMany();

    return rows.map((business) => ({
      kind: "business",
      id: business.id,
      slug: business.slug,
      name: business.name,
      image: business.images[0] ?? business.logoImage ?? null,
      type: business.type,
      city: business.linkedPlace.city,
      county: { name: business.linkedPlace.county.name },
    }));
  }

  private async suggestEvents(query: string): Promise<EventSearchSuggestion[]> {
    const pattern = escapeLikePattern(query);
    const rows = await this.eventRepo
      .createQueryBuilder("event")
      .leftJoinAndSelect("event.place", "place")
      .leftJoinAndSelect("event.county", "county")
      .where("event.reviewStatus = :status", {
        status: EventReviewStatus.APPROVED,
      })
      .andWhere("event.name ILIKE :contains", { contains: `%${pattern}%` })
      .addSelect(
        "(CASE WHEN event.name ILIKE :starts THEN 0 ELSE 1 END)",
        "prefix_rank",
      )
      .setParameter("starts", `${pattern}%`)
      // Soonest first among equally-good name matches — a past event
      // is still a valid result (its page still exists), just a less
      // useful default lead than one still coming up.
      .orderBy("prefix_rank", "ASC")
      .addOrderBy("event.startDate", "ASC")
      .take(SUGGEST_LIMIT)
      .getMany();

    return rows.map((event) => ({
      kind: "event",
      id: event.id,
      name: event.name,
      image: event.images[0] ?? null,
      category: event.category,
      startDate: event.startDate as unknown as string,
      endDate: event.endDate as unknown as string | null,
      locationText: event.locationText,
      place: event.place ? { name: event.place.name } : null,
      county: { name: event.county.name },
    }));
  }

  private async suggestCreators(
    query: string,
  ): Promise<CreatorSearchSuggestion[]> {
    const pattern = escapeLikePattern(query);
    const rows = await this.creatorRepo
      .createQueryBuilder("creator")
      .leftJoinAndSelect("creator.county", "county")
      .where(
        "(creator.name ILIKE :contains OR creator.username ILIKE :contains)",
        {
          contains: `%${pattern}%`,
        },
      )
      .addSelect(
        "(CASE WHEN creator.name ILIKE :starts OR creator.username ILIKE :starts THEN 0 ELSE 1 END)",
        "prefix_rank",
      )
      .setParameter("starts", `${pattern}%`)
      .orderBy("prefix_rank", "ASC")
      .addOrderBy("creator.featured", "DESC")
      .addOrderBy("creator.followerCount", "DESC")
      .take(SUGGEST_LIMIT)
      .getMany();

    return rows.map((creator) => ({
      kind: "creator",
      id: creator.id,
      username: creator.username,
      name: creator.name,
      image: creator.profileImage ?? null,
      category: creator.category,
      county: creator.county ? { name: creator.county.name } : null,
    }));
  }
}
