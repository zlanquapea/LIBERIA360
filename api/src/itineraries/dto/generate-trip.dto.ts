import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { BudgetBand } from "../entities/itinerary.enums";

/** "Build My Liberia Trip" (Tech Spec §4.3): trip length + interests + budget. */
export class GenerateTripDto {
  @IsInt()
  @Min(1)
  @Max(14)
  durationDays: number;

  @IsOptional()
  @IsDateString()
  startDate?: string; // stored for context; doesn't affect place selection

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  interests: string[]; // category slugs

  @IsEnum(BudgetBand)
  budgetBand: BudgetBand;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}
