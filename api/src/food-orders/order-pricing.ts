import { BadRequestException } from "@nestjs/common";
import type { MenuItem } from "../menu-items/entities/menu-item.entity";
import type { FoodOrderLineOption } from "./entities/food-order.entity";
import type { FoodOrderSelectionDto } from "./dto/create-food-order.dto";
import { FoodPaymentMethod } from "./entities/food-order.enums";
import type { MenuSettingsView } from "../menu-items/menu-items.service";

/** Validates a customer's chosen options against the item's live option
 * groups and returns the snapshot to store plus the resulting unit price.
 * Never trusts a client-sent price: every delta comes from the menu. */
export function priceLine(
  menuItem: Pick<MenuItem, "name" | "price" | "optionGroups">,
  selections: FoodOrderSelectionDto[] = [],
): { unitPrice: number; options: FoodOrderLineOption[] } {
  const groups = menuItem.optionGroups ?? [];
  const chosenByGroup = new Map<string, string[]>();

  for (const selection of selections) {
    if (chosenByGroup.has(selection.groupId)) {
      throw new BadRequestException(
        `Duplicate option group on ${menuItem.name}`,
      );
    }
    chosenByGroup.set(selection.groupId, selection.choiceIds);
  }

  for (const groupId of chosenByGroup.keys()) {
    if (!groups.some((group) => group.id === groupId)) {
      throw new BadRequestException(
        `${menuItem.name}'s options have changed — please re-add it to your order`,
      );
    }
  }

  const options: FoodOrderLineOption[] = [];
  let unitPrice = menuItem.price;

  for (const group of groups) {
    const choiceIds = chosenByGroup.get(group.id) ?? [];
    if (new Set(choiceIds).size !== choiceIds.length) {
      throw new BadRequestException(
        `Duplicate choice for "${group.name}" on ${menuItem.name}`,
      );
    }
    if (group.required && choiceIds.length === 0) {
      throw new BadRequestException(
        `Choose an option for "${group.name}" on ${menuItem.name}`,
      );
    }
    if (choiceIds.length > group.maxSelections) {
      throw new BadRequestException(
        `Choose at most ${group.maxSelections} for "${group.name}" on ${menuItem.name}`,
      );
    }
    if (choiceIds.some((id) => !group.choices.some((c) => c.id === id))) {
      throw new BadRequestException(
        `${menuItem.name}'s options have changed — please re-add it to your order`,
      );
    }
    // Menu order, not click order, so the same choices always read the
    // same way on the order.
    for (const choice of group.choices) {
      if (!choiceIds.includes(choice.id)) continue;
      unitPrice += choice.priceDelta;
      options.push({
        group: group.name,
        choice: choice.name,
        priceDelta: choice.priceDelta.toFixed(2),
      });
    }
  }

  return { unitPrice: Math.round(unitPrice * 100) / 100, options };
}

type FulfillmentSettings = Pick<
  MenuSettingsView,
  "deliveryFee" | "freeDeliveryMinimum"
>;

/** What delivery costs for an order with this subtotal: the flat fee,
 * waived once the subtotal reaches the free-delivery minimum. */
export function deliveryFeeFor(
  settings: FulfillmentSettings,
  subtotal: number,
): number {
  if (
    settings.freeDeliveryMinimum !== null &&
    subtotal >= settings.freeDeliveryMinimum
  ) {
    return 0;
  }
  return Number(settings.deliveryFee) || 0;
}

type PaymentSettings = Pick<
  MenuSettingsView,
  "cashEnabled" | "mtnMomoNumber" | "orangeMoneyNumber"
>;

/** The number a mobile money method pays into, or null when the
 * restaurant doesn't take it (cash never has one). */
export function paymentAccountFor(
  settings: PaymentSettings,
  method: FoodPaymentMethod,
): string | null {
  if (method === FoodPaymentMethod.MTN_MOMO) return settings.mtnMomoNumber;
  if (method === FoodPaymentMethod.ORANGE_MONEY) {
    return settings.orangeMoneyNumber;
  }
  return null;
}

export function acceptsPaymentMethod(
  settings: PaymentSettings,
  method: FoodPaymentMethod,
): boolean {
  return method === FoodPaymentMethod.CASH
    ? settings.cashEnabled
    : paymentAccountFor(settings, method) !== null;
}
