import { BadRequestException } from "@nestjs/common";
import {
  acceptsPaymentMethod,
  deliveryFeeFor,
  paymentAccountFor,
  priceLine,
} from "./order-pricing";
import { FoodPaymentMethod } from "./entities/food-order.enums";
import type { MenuOptionGroup } from "../menu-items/entities/menu-item.enums";

const SIZE: MenuOptionGroup = {
  id: "size",
  name: "Size",
  required: true,
  maxSelections: 1,
  choices: [
    { id: "reg", name: "Regular", priceDelta: 0 },
    { id: "lg", name: "Large", priceDelta: 2 },
  ],
};

const EXTRAS: MenuOptionGroup = {
  id: "extras",
  name: "Extras",
  required: false,
  maxSelections: 2,
  choices: [
    { id: "egg", name: "Egg", priceDelta: 0.5 },
    { id: "plantain", name: "Plantain", priceDelta: 1.25 },
    { id: "fish", name: "Fish", priceDelta: 3 },
  ],
};

const item = (optionGroups: MenuOptionGroup[] = [SIZE, EXTRAS]) => ({
  name: "Jollof Rice",
  price: 10,
  optionGroups,
});

describe("priceLine", () => {
  it("returns the base price for an item with no options", () => {
    expect(priceLine(item([]))).toEqual({ unitPrice: 10, options: [] });
  });

  it("adds each chosen choice's delta in menu order", () => {
    const result = priceLine(item(), [
      { groupId: "extras", choiceIds: ["plantain", "egg"] },
      { groupId: "size", choiceIds: ["lg"] },
    ]);
    expect(result.unitPrice).toBe(13.75);
    expect(result.options.map((o) => o.choice)).toEqual([
      "Large",
      "Egg",
      "Plantain",
    ]);
  });

  it("rejects a missing required group", () => {
    expect(() => priceLine(item(), [])).toThrow(BadRequestException);
  });

  it("rejects more choices than a group allows", () => {
    expect(() =>
      priceLine(item(), [
        { groupId: "size", choiceIds: ["reg"] },
        { groupId: "extras", choiceIds: ["egg", "plantain", "fish"] },
      ]),
    ).toThrow(BadRequestException);
  });

  it("rejects a choice that no longer exists", () => {
    expect(() =>
      priceLine(item(), [{ groupId: "size", choiceIds: ["xl"] }]),
    ).toThrow(BadRequestException);
  });

  it("rejects a group that no longer exists", () => {
    expect(() =>
      priceLine(item(), [
        { groupId: "size", choiceIds: ["reg"] },
        { groupId: "sauce", choiceIds: ["pepper"] },
      ]),
    ).toThrow(BadRequestException);
  });

  it("rejects the same choice picked twice", () => {
    expect(() =>
      priceLine(item(), [
        { groupId: "size", choiceIds: ["reg"] },
        { groupId: "extras", choiceIds: ["egg", "egg"] },
      ]),
    ).toThrow(BadRequestException);
  });

  it("rejects the same group sent twice", () => {
    expect(() =>
      priceLine(item(), [
        { groupId: "size", choiceIds: ["reg"] },
        { groupId: "size", choiceIds: ["lg"] },
      ]),
    ).toThrow(BadRequestException);
  });
});

describe("deliveryFeeFor", () => {
  it("charges the flat fee below the free-delivery minimum", () => {
    expect(
      deliveryFeeFor({ deliveryFee: 2, freeDeliveryMinimum: 25 }, 24.99),
    ).toBe(2);
  });

  it("waives the fee at or above the minimum", () => {
    expect(
      deliveryFeeFor({ deliveryFee: 2, freeDeliveryMinimum: 25 }, 25),
    ).toBe(0);
  });

  it("always charges the fee when there's no minimum, and 0 means free", () => {
    expect(
      deliveryFeeFor({ deliveryFee: 3, freeDeliveryMinimum: null }, 500),
    ).toBe(3);
    expect(
      deliveryFeeFor({ deliveryFee: 0, freeDeliveryMinimum: null }, 5),
    ).toBe(0);
  });
});

describe("acceptsPaymentMethod / paymentAccountFor", () => {
  const settings = {
    cashEnabled: false,
    mtnMomoNumber: null,
    orangeMoneyNumber: "0777 123 456",
  };

  it("offers a mobile money method only when its number is set", () => {
    expect(acceptsPaymentMethod(settings, FoodPaymentMethod.ORANGE_MONEY)).toBe(
      true,
    );
    expect(acceptsPaymentMethod(settings, FoodPaymentMethod.MTN_MOMO)).toBe(
      false,
    );
    expect(paymentAccountFor(settings, FoodPaymentMethod.ORANGE_MONEY)).toBe(
      "0777 123 456",
    );
  });

  it("follows the cash toggle for cash, which has no account", () => {
    expect(acceptsPaymentMethod(settings, FoodPaymentMethod.CASH)).toBe(false);
    expect(
      paymentAccountFor(
        { ...settings, cashEnabled: true },
        FoodPaymentMethod.CASH,
      ),
    ).toBeNull();
  });
});
