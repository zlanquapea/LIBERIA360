import { fireEvent, render, screen, within } from "@testing-library/react";
import { MenuItemsManager } from "./MenuItemsManager";
import type { MenuItem } from "@/lib/types";

const api = {
  getMenuItems: jest.fn(),
  getMenuSettings: jest.fn(),
  updateMenuSettings: jest.fn(),
  createMenuItem: jest.fn(),
  updateMenuItem: jest.fn(),
  deleteMenuItem: jest.fn(),
};
jest.mock("../lib/menu-items-api", () => ({
  getMenuItems: (...a: unknown[]) => api.getMenuItems(...a),
  getMenuSettings: (...a: unknown[]) => api.getMenuSettings(...a),
  updateMenuSettings: (...a: unknown[]) => api.updateMenuSettings(...a),
  createMenuItem: (...a: unknown[]) => api.createMenuItem(...a),
  updateMenuItem: (...a: unknown[]) => api.updateMenuItem(...a),
  deleteMenuItem: (...a: unknown[]) => api.deleteMenuItem(...a),
}));
jest.mock("./ConfirmDialog", () => ({ ConfirmDialog: () => null }));
jest.mock("./BrandLoader", () => ({ BrandLoader: () => null }));
jest.mock("./SingleImageUploader", () => ({
  SingleImageUploader: () => <div data-testid="uploader" />,
}));

const beer: MenuItem = {
  id: "beer",
  businessId: "biz-1",
  name: "Club Beer",
  description: null,
  price: 250,
  image: null,
  category: "Beer",
  isAvailable: true,
  sortOrder: 0,
  kind: "drink",
  tags: [],
  servingSize: "600ml",
  containsAlcohol: true,
  optionGroups: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getMenuItems.mockResolvedValue([beer]);
  api.getMenuSettings.mockResolvedValue({ businessId: "biz-1", currency: "LRD" });
});

describe("MenuItemsManager", () => {
  it("shows prices in the saved menu currency and switches currency", async () => {
    api.updateMenuSettings.mockResolvedValue({ businessId: "biz-1", currency: "USD" });
    render(<MenuItemsManager token="tok" businessId="biz-1" businessType="bar" />);

    expect(await screen.findByText("L$250")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Liberian Dollars/ })).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: /US Dollars/ }));
    expect(api.updateMenuSettings).toHaveBeenCalledWith("tok", "biz-1", { currency: "USD" });
    expect(await screen.findByText("US$250.00")).toBeInTheDocument();
  });

  it("adds a drink with a size option through the editor", async () => {
    api.createMenuItem.mockImplementation(async (_t: string, input: Partial<MenuItem>) => ({
      ...beer,
      ...input,
      id: "new",
      optionGroups: [],
    }));
    render(<MenuItemsManager token="tok" businessId="biz-1" businessType="bar" />);
    await screen.findByText("Club Beer");

    fireEvent.click(screen.getByRole("button", { name: "Add item" }));
    const editor = screen.getByRole("dialog", { name: "Add a menu item" });
    // Bars start new items as drinks.
    expect(within(editor).getByRole("radio", { name: /Drinks/ })).toHaveAttribute("aria-checked", "true");

    fireEvent.click(within(editor).getByRole("button", { name: "Save item" }));
    expect(within(editor).getByRole("alert")).toHaveTextContent("Give the item a name");
    expect(api.createMenuItem).not.toHaveBeenCalled();

    fireEvent.change(within(editor).getByRole("textbox", { name: "Name" }), { target: { value: "Palm Wine" } });
    fireEvent.change(within(editor).getByRole("spinbutton", { name: /Price/ }), { target: { value: "300" } });
    fireEvent.click(within(editor).getByRole("button", { name: "Size" }));
    fireEvent.click(within(editor).getByRole("button", { name: "Save item" }));

    expect(api.createMenuItem).toHaveBeenCalledWith(
      "tok",
      expect.objectContaining({
        businessId: "biz-1",
        name: "Palm Wine",
        price: 300,
        kind: "drink",
        optionGroups: [
          expect.objectContaining({
            name: "Size",
            required: true,
            maxSelections: 1,
            choices: [
              { name: "Regular", priceDelta: 0 },
              { name: "Large", priceDelta: 2 },
            ],
          }),
        ],
      }),
    );
    expect(await screen.findByText("Palm Wine")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
