import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class FoodOrderItemDto {
  @IsUUID()
  menuItemId: string;

  @IsInt()
  @Min(1)
  @Max(20)
  quantity: number;
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
}
