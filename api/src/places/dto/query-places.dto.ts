import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { PlaceType } from "../entities/place.enums";

export type PlaceSort = "featured" | "rating" | "distance" | "name";
const SORT_VALUES: PlaceSort[] = ["featured", "rating", "distance", "name"];

/**
 * GET /places query params (Tech Spec §10): filters by category, county,
 * tag, and free-text search, plus Phase 2 "Near Me" radius search (§3.2) —
 * `lat`/`lng`/`radiusKm` must be supplied together. Radius search uses a
 * Haversine formula in SQL rather than PostGIS (see api/README.md); fine at
 * this catalog size, worth revisiting if the catalog grows a lot.
 */
export class QueryPlacesDto {
  @IsOptional()
  @IsString()
  category?: string; // category slug

  @IsOptional()
  @IsString()
  county?: string; // county slug

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsEnum(PlaceType)
  type?: PlaceType;

  // Postgres full-text search across name (weighted higher)/description —
  // see SEARCH_VECTOR_SQL in places.service.ts — not a substring match, so
  // this accepts websearch_to_tsquery's plain search-engine-style syntax
  // (quoted phrases, "or", a leading "-" to exclude a word).
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(SORT_VALUES)
  sort?: PlaceSort = "featured";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  // "Near Me" (Tech Spec §3.2) — 5/10/25/50 km presets from the client, but
  // any value in a sane range is accepted.
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(200)
  radiusKm?: number;

  // Filters to places whose structuredHours (opening-hours.ts) say they're
  // open right now. A place with no parseable hours is never included —
  // "we don't know" is not "open" — so this is necessarily conservative,
  // not exhaustive: it can under-include places whose hours just weren't
  // in a format the parser recognizes.
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  openNow?: boolean;

  // Filters by place.estimatedCostEntry (the entry/admission cost shown
  // on the destination profile and used for the search result's price
  // display) — USD. Same "we don't know" conservativism as openNow: a
  // place with no cost on file is excluded once either bound is set,
  // rather than assumed to be in range.
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceMax?: number;
}
