import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { BudgetBand } from "../entities/itinerary.enums";

/** Weekend Explorer (Tech Spec §3.2): starting point, budget, travel time, interests. */
export class GenerateWeekendDto {
  @IsLatitude()
  startLat: number;

  @IsLongitude()
  startLng: number;

  @IsInt()
  @Min(15)
  @Max(240)
  maxTravelTimeMinutes: number;

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  interests: string[];

  @IsEnum(BudgetBand)
  budgetBand: BudgetBand;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  durationDays?: number = 1;
}
