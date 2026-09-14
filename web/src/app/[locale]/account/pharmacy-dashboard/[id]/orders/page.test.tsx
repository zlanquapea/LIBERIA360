import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PharmacyOrdersPage from "./page";
import { PharmacyDashboardProvider } from "@/components/PharmacyDashboardContext";
import type {
  Pharmacy,
  PharmacyOrder,
  PharmacyStats,
} from "@/lib/pharmacy-api";
import {
  getPharmacyDashboardOrders,
  restorePharmacyOrder,
  transitionPharmacyOrder,
} from "@/lib/pharmacy-api";

// jest.mock's module specifier is a plain string, not an import
// declaration — the '@/...' alias only gets resolved by SWC's transform on
// real import statements (see PharmacyShop.test.tsx's own note on this),
// so this needs the relative path to resolve to the same module page.tsx
// imports via '@/lib/pharmacy-api'.
jest.mock("../../../../../../lib/pharmacy-api", () => {
  const actual = jest.requireActual("../../../../../../lib/pharmacy-api");
  return {
    ...actual,
    getPharmacyDashboardOrders: jest.fn(),
    restorePharmacyOrder: jest.fn(),
    transitionPharmacyOrder: jest.fn(),
    reviewPharmacyPrescription: jest.fn(),
  };
});

const mockedGetOrders = getPharmacyDashboardOrders as jest.Mock;
const mockedRestore = restorePharmacyOrder as jest.Mock;
const mockedTransition = transitionPharmacyOrder as jest.Mock;

const pharmacy: Pharmacy = {
  id: "pharmacy-1",
  name: "Test Pharmacy",
  slug: "test-pharmacy",
  placeId: null,
  address: "1 Test St",
  location: "Monrovia",
  telephone: "+231770000000",
  logoUrl: null,
  coverUrl: null,
  latitude: null,
  longitude: null,
  pickupEnabled: true,
  deliveryEnabled: false,
  deliveryFee: 0,
  status: "approved",
  sponsored: false,
};

const stats: PharmacyStats = {
  totalOrders: 1,
  completedOrders: 0,
  pendingOrders: 0,
  revenue: 0,
  role: "manager",
};

function renderPage() {
  return render(
    <PharmacyDashboardProvider
      value={{
        pharmacy,
        stats,
        onPharmacyUpdated: () => {},
        reloadStats: () => {},
      }}
    >
      <PharmacyOrdersPage />
    </PharmacyDashboardProvider>,
  );
}

describe("Pharmacy dashboard orders — restoring a mistaken cancellation", () => {
  beforeEach(() => {
    mockedGetOrders.mockReset();
    mockedRestore.mockReset();
    mockedTransition.mockReset();
  });

  it("offers Restore on a cancelled order that has somewhere to go back to, and not otherwise", async () => {
    const cancelledWithHistory: PharmacyOrder = {
      id: "order-1",
      pharmacyId: "pharmacy-1",
      status: "cancelled",
      previousStatus: "accepted",
      fulfillmentMethod: "pickup",
      productSubtotal: 10,
      deliveryFee: 0,
      platformFee: 0,
      finalTotal: 10,
      createdAt: new Date().toISOString(),
    };
    const cancelledWithNoHistory: PharmacyOrder = {
      ...cancelledWithHistory,
      id: "order-2",
      previousStatus: null,
    };
    mockedGetOrders.mockResolvedValue([
      cancelledWithHistory,
      cancelledWithNoHistory,
    ]);

    renderPage();

    expect(
      await screen.findByRole("button", { name: /restore to accepted/i }),
    ).toBeInTheDocument();
    // Only one order actually has a previousStatus to restore to.
    expect(
      screen.queryAllByRole("button", { name: /restore/i }),
    ).toHaveLength(1);
  });

  it("restores the order and reloads the list on success", async () => {
    const cancelled: PharmacyOrder = {
      id: "order-1",
      pharmacyId: "pharmacy-1",
      status: "cancelled",
      previousStatus: "pending",
      fulfillmentMethod: "pickup",
      productSubtotal: 10,
      deliveryFee: 0,
      platformFee: 0,
      finalTotal: 10,
      createdAt: new Date().toISOString(),
    };
    mockedGetOrders.mockResolvedValue([cancelled]);
    mockedRestore.mockResolvedValue({ ...cancelled, status: "pending", previousStatus: null });

    renderPage();

    const restoreButton = await screen.findByRole("button", {
      name: /restore to pending/i,
    });
    fireEvent.click(restoreButton);

    await waitFor(() =>
      expect(mockedRestore).toHaveBeenCalledWith("pharmacy-1", "order-1"),
    );
    // Reload after a successful restore, same as every other mutation on
    // this page (transition(), review()).
    await waitFor(() => expect(mockedGetOrders).toHaveBeenCalledTimes(2));
  });

  it("shows a per-order error when restoring fails, without touching the shared error banner", async () => {
    const cancelled: PharmacyOrder = {
      id: "order-1",
      pharmacyId: "pharmacy-1",
      status: "cancelled",
      previousStatus: "pending",
      fulfillmentMethod: "pickup",
      productSubtotal: 10,
      deliveryFee: 0,
      platformFee: 0,
      finalTotal: 10,
      createdAt: new Date().toISOString(),
    };
    mockedGetOrders.mockResolvedValue([cancelled]);
    mockedRestore.mockRejectedValue(
      new Error("Paracetamol no longer has enough stock to restore this order"),
    );

    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: /restore to pending/i }),
    );

    expect(
      await screen.findByText(
        /paracetamol no longer has enough stock to restore this order/i,
      ),
    ).toBeInTheDocument();
    expect(mockedTransition).not.toHaveBeenCalled();
  });

  it("never offers Restore on an order that isn't cancelled", async () => {
    const active: PharmacyOrder = {
      id: "order-1",
      pharmacyId: "pharmacy-1",
      status: "pending",
      previousStatus: null,
      fulfillmentMethod: "pickup",
      productSubtotal: 10,
      deliveryFee: 0,
      platformFee: 0,
      finalTotal: 10,
      createdAt: new Date().toISOString(),
    };
    mockedGetOrders.mockResolvedValue([active]);

    renderPage();

    await screen.findByText(/order #/i);
    expect(
      screen.queryByRole("button", { name: /restore/i }),
    ).not.toBeInTheDocument();
  });
});
