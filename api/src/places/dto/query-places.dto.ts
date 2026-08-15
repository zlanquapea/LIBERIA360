import { Type } from "class-transformer";
import {
  IsEnum,
  IsIn,
  IsInt,
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
 * tag, and free-text search. Radius/"near me" search is Phase 2 (§3.2) and
 * intentionally not implemented here — see api/README.md.
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

  @IsOptional()
  @IsString()
  q?: string; // free-text search across name/description

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
}
