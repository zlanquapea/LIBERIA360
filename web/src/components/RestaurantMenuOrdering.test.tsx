import { fireEvent, screen, within } from "@testing-library/react";
import { renderWithMessages } from "@/test/render-with-messages";
import { RestaurantMenuOrdering } from "./RestaurantMenuOrdering";
import type { Business, FoodOrder, MenuItem, MenuSettings } from "@/lib/types";

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

const settings: MenuSettings = {
  businessId: "biz-1",
  currency: "USD",
  pickupEnabled: true,
  deliveryEnabled: true,
  deliveryFee: 2,
  freeDeliveryMinimum: 25,
  deliveryAreas: "Sinkor, Congo Town",
  deliveryEstimate: "30–45 min",
  cashEnabled: true,
  mtnMomoNumber: null,
  orangeMoneyNumber: "0777 123 456",
  mobileMoneyName: "Sunset Lounge Ltd",
};

function renderMenu(overrides: Partial<MenuSettings> = {}) {
  return renderWithMessages(
    <RestaurantMenuOrdering
      business={business}
      items={[mojito, wings]}
      settings={{ ...settings, ...overrides }}
      usdToLrdRate={190}
    />,
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

  it("shows the delivery fee, delivery time and accepted payments up front", () => {
    renderMenu();
    const info = screen.getByRole("list", { name: "Delivery and payment" });
    expect(within(info).getByText("Delivery US$2.00 · free over US$25.00")).toBeInTheDocument();
    expect(within(info).getByText("30–45 min")).toBeInTheDocument();
    expect(within(info).getByText("Orange Money")).toBeInTheDocument();
    expect(within(info).queryByText("MTN MoMo")).not.toBeInTheDocument();
    expect(screen.getByText("Delivers to Sinkor, Congo Town")).toBeInTheDocument();
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
    fireEvent.click(within(cart).getByRole("button", { name: /Continue to checkout/ }));

    const checkout = screen.getByRole("dialog", { name: "Checkout" });
    fireEvent.click(within(checkout).getByRole("radio", { name: /Pickup/ }));
    fireEvent.click(within(checkout).getByRole("button", { name: /Place order/ }));
    expect(within(checkout).getByRole("alert")).toHaveTextContent("Confirm you’re 18 or older");
    expect(mockCreateFoodOrder).not.toHaveBeenCalled();

    fireEvent.click(within(checkout).getByRole("checkbox", { name: /18 or older/ }));
    fireEvent.click(within(checkout).getByRole("button", { name: /Place order\s*US\$8\.50/ }));

    expect(await screen.findByText("Order sent!")).toBeInTheDocument();
    expect(mockCreateFoodOrder).toHaveBeenCalledWith("tok", "biz-1", {
      items: [{ menuItemId: "mojito", quantity: 1, selections: [{ groupId: "rum", choiceIds: ["premium"] }] }],
      notes: undefined,
      ageConfirmed: true,
      fulfillment: "pickup",
      deliveryAddress: undefined,
      contactPhone: undefined,
      paymentMethod: "cash",
      paymentReference: undefined,
    });
  });

  it("checks out a delivery paid by Orange Money, ticket-style", async () => {
    mockCreateFoodOrder.mockResolvedValue({
      totalAmount: 10,
      currency: "USD",
      paymentMethod: "orange_money",
      paymentReference: "OM-48213",
      fulfillment: "delivery",
    } as FoodOrder);
    renderMenu();
    fireEvent.click(screen.getByRole("tab", { name: /Food/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add Pepper Wings to order" }));
    fireEvent.click(screen.getByRole("button", { name: /View order/ }));
    fireEvent.click(screen.getByRole("button", { name: /Continue to checkout/ }));

    const sheet = screen.getByRole("dialog", { name: "Checkout" });
    // Delivery is the default when offered, and adds the fee.
    expect(within(sheet).getByRole("radio", { name: /Delivery/ })).toBeChecked();
    expect(within(sheet).getByRole("button", { name: /Place order\s*US\$10\.00/ })).toBeInTheDocument();

    fireEvent.click(within(sheet).getByRole("button", { name: /Place order/ }));
    expect(within(sheet).getByRole("alert")).toHaveTextContent("Add the address to deliver to");

    fireEvent.change(within(sheet).getByRole("textbox", { name: "Delivery address" }), {
      target: { value: "12 Tubman Blvd, Sinkor" },
    });
    fireEvent.change(within(sheet).getByRole("textbox", { name: /Phone number/ }), {
      target: { value: "0886 555 000" },
    });
    fireEvent.click(within(sheet).getByRole("radio", { name: /Orange Money/ }));
    // The ticket-style instructions: exact amount and the restaurant's number.
    expect(within(sheet).getByText("0777 123 456")).toBeInTheDocument();
    expect(within(sheet).getByText("Sunset Lounge Ltd")).toBeInTheDocument();

    fireEvent.click(within(sheet).getByRole("button", { name: /Submit payment & order/ }));
    expect(within(sheet).getByRole("alert")).toHaveTextContent("Enter the Orange Money transaction ID");

    fireEvent.change(within(sheet).getByPlaceholderText("Transaction ID"), { target: { value: " OM-48213 " } });
    fireEvent.click(within(sheet).getByRole("button", { name: /Submit payment & order/ }));

    expect(await screen.findByText(/check your Orange Money payment \(transaction OM-48213\)/)).toBeInTheDocument();
    expect(mockCreateFoodOrder).toHaveBeenCalledWith(
      "tok",
      "biz-1",
      expect.objectContaining({
        fulfillment: "delivery",
        deliveryAddress: "12 Tubman Blvd, Sinkor",
        contactPhone: "0886 555 000",
        paymentMethod: "orange_money",
        paymentReference: "OM-48213",
      }),
    );
    // Address and phone are remembered for next time; payment details aren't.
    expect(JSON.parse(window.localStorage.getItem("liberia360:delivery-contact") ?? "{}")).toEqual({
      deliveryAddress: "12 Tubman Blvd, Sinkor",
      contactPhone: "0886 555 000",
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
