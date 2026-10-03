import { BadRequestException } from "@nestjs/common";
import { priceLine } from "./order-pricing";
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
