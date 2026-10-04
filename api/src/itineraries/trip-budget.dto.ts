import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class BudgetTravelerDto {
  @IsUUID() id: string;
  @IsString() @MinLength(1) @MaxLength(80) name: string;
}
export class TripExpenseDto {
  @IsUUID() id: string;
  @IsString() @MinLength(1) @MaxLength(160) description: string;
  @IsIn(["transport", "stay", "food", "activity", "other"]) category: string;
  @IsInt() @Min(1) @Max(10000000000) amountMinor: number;
  @IsUUID() paidBy: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  splitBetween: string[];
  @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
}
export class SaveTripBudgetDto {
  @IsInt() @Min(0) @Max(2147483646) version: number;
  @IsIn(["USD", "LRD"]) currency: "USD" | "LRD";
  @IsInt() @Min(0) @Max(10000000000) budgetMinor: number;
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BudgetTravelerDto)
  travelers: BudgetTravelerDto[];
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => TripExpenseDto)
  expenses: TripExpenseDto[];
}
