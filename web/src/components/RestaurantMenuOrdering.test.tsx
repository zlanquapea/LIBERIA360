import { fireEvent, render, screen, within } from "@testing-library/react";
import { RestaurantMenuOrdering } from "./RestaurantMenuOrdering";
import type { Business, FoodOrder, MenuItem } from "@/lib/types";

const mockUseAuth = jest.fn();
jest.mock("../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));
const mockCreateFoodOrder = jest.fn();
jest.mock("../lib/food-orders-api", () => ({
  createFoodOrder: (...args: unknown[]) => mockCreateFoodOrder(...args),
}));

const business = {
  id: "biz-1",
  slug: "sunset-lounge",
  name: "Sunset Lounge",
  type: "bar",
  images: [],
  linkedPlace: { images: [], rating: 4.5, reviewCount: 12, county: { name: "Montserrado" } },
  verificationStatus: "unverified",
  averageRating: null,
  reviewCount: 0,
} as unknown as Business;

function makeItem(overrides: Partial<MenuItem> & { id: string; name: string }): MenuItem {
  return {
    businessId: "biz-1",
    description: null,
    price: 5,
    image: null,
    category: null,
    isAvailable: true,
    sortOrder: 0,
    kind: "food",
    tags: [],
    servingSize: null,
    containsAlcohol: false,
    optionGroups: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const mojito = makeItem({
  id: "mojito",
  name: "Mojito",
  kind: "drink",
  price: 6,
  containsAlcohol: true,
  optionGroups: [
    {
      id: "rum",
      name: "Rum",
      required: true,
      maxSelections: 1,
      choices: [
        { id: "house", name: "House rum", priceDelta: 0 },
        { id: "premium", name: "Premium rum", priceDelta: 2.5 },
      ],
    },
  ],
});
const wings = makeItem({ id: "wings", name: "Pepper Wings", price: 8 });

function renderMenu() {
  return render(
    <RestaurantMenuOrdering business={business} items={[mojito, wings]} currency="USD" usdToLrdRate={190} />,
  );
}

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  window.localStorage.clear();
  mockCreateFoodOrder.mockReset();
  mockUseAuth.mockReturnValue({ user: { id: "u1" }, token: "tok" });
});

describe("RestaurantMenuOrdering", () => {
  it("leads a bar's menu with drinks and shows the LRD estimate", () => {
    renderMenu();
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveTextContent("Drinks");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByText("≈ L$1,140").length).toBeGreaterThan(0);
  });

  it("customizes a drink, gates alcohol on the 18+ confirmation, and sends selections", async () => {
    mockCreateFoodOrder.mockResolvedValue({ totalAmount: 8.5, currency: "USD" } as FoodOrder);
    renderMenu();

    fireEvent.click(screen.getByRole("button", { name: "Choose options for Mojito" }));
    const sheet = screen.getByRole("dialog", { name: "Mojito" });
    // The required pick-one group starts on its first choice.
    expect(within(sheet).getByRole("radio", { name: /House rum/ })).toBeChecked();
    fireEvent.click(within(sheet).getByRole("radio", { name: /Premium rum/ }));
    fireEvent.click(within(sheet).getByRole("button", { name: /Add to order\s*US\$8\.50/ }));

    fireEvent.click(screen.getByRole("button", { name: /View order/ }));
    const cart = screen.getByRole("dialog", { name: "Your order" });
    expect(within(cart).getByText("Premium rum")).toBeInTheDocument();
    const placeOrder = within(cart).getByRole("button", { name: /Place order/ });
    expect(placeOrder).toBeDisabled();

    fireEvent.click(within(cart).getByRole("checkbox", { name: /18 or older/ }));
    expect(placeOrder).toBeEnabled();
    fireEvent.click(placeOrder);

    expect(await screen.findByText("Order sent!")).toBeInTheDocument();
    expect(mockCreateFoodOrder).toHaveBeenCalledWith("tok", "biz-1", {
      items: [{ menuItemId: "mojito", quantity: 1, selections: [{ groupId: "rum", choiceIds: ["premium"] }] }],
      notes: undefined,
      ageConfirmed: true,
    });
  });

  it("quick-adds a plain item and asks signed-out guests to log in, keeping their cart", () => {
    mockUseAuth.mockReturnValue({ user: null, token: null });
    renderMenu();
    fireEvent.click(screen.getByRole("tab", { name: /Food/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add Pepper Wings to order" }));
    expect(JSON.parse(window.localStorage.getItem("liberia360:menu-cart:biz-1") ?? "[]")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: /View order/ }));
    const login = screen.getByRole("link", { name: /Log in to place your order/ });
    expect(login).toHaveAttribute("href", "/login?next=%2Fbusinesses%2Fsunset-lounge%2Fmenu");
    expect(screen.queryByRole("button", { name: /Place order/ })).not.toBeInTheDocument();
  });
});
