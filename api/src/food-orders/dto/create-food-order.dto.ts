import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class FoodOrderSelectionDto {
  @IsString() @MaxLength(64) groupId: string;

  @IsString({ each: true })
  @MaxLength(64, { each: true })
  @ArrayMaxSize(20)
  choiceIds: string[];
}

export class FoodOrderItemDto {
  @IsUUID()
  menuItemId: string;

  @IsInt()
  @Min(1)
  @Max(20)
  quantity: number;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FoodOrderSelectionDto)
  @ArrayMaxSize(10)
  selections?: FoodOrderSelectionDto[];
}

export class CreateFoodOrderDto {
  @ValidateNested({ each: true })
  @Type(() => FoodOrderItemDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  items: FoodOrderItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  // Required (true) whenever the order includes an item marked
  // containsAlcohol — see FoodOrdersService.create.
  @IsOptional()
  @IsBoolean()
  ageConfirmed?: boolean;
}
