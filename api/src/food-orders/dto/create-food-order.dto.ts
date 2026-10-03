import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import {
  FoodFulfillment,
  FoodPaymentMethod,
} from "../entities/food-order.enums";

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

  // Defaults to pickup / cash so older clients keep working.
  @IsOptional() @IsEnum(FoodFulfillment) fulfillment?: FoodFulfillment;

  // Required for delivery — see FoodOrdersService.create.
  @IsOptional() @IsString() @MaxLength(300) deliveryAddress?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9][0-9 -]{5,18}[0-9]$/, {
    message: "Enter a valid phone number",
  })
  contactPhone?: string;

  @IsOptional() @IsEnum(FoodPaymentMethod) paymentMethod?: FoodPaymentMethod;

  // The mobile money transaction ID; required for MTN MoMo / Orange Money.
  @IsOptional() @IsString() @MaxLength(100) paymentReference?: string;
}
