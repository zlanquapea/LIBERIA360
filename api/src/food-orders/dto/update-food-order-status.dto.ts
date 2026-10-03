import { IsIn } from "class-validator";
import { FoodOrderStatus } from "../entities/food-order.enums";

export const OWNER_PROGRESS_STATUSES = [
  FoodOrderStatus.PREPARING,
  FoodOrderStatus.READY,
  FoodOrderStatus.OUT_FOR_DELIVERY,
  FoodOrderStatus.COMPLETED,
] as const;

export class UpdateFoodOrderStatusDto {
  @IsIn(OWNER_PROGRESS_STATUSES)
  status: (typeof OWNER_PROGRESS_STATUSES)[number];
}
