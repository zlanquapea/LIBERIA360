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
  markPharmacyRefunded,
  restorePharmacyOrder,
  transitionPharmacyOrder,
  verifyPharmacyPayment,
} from "@/lib/pharmacy-api";

// jest.mock's module specifier is a plain string, not an import
// declaration — the '@/...' alias only gets resolved by SWC's transform on
// real import statements (jest.mock specifiers are not rewritten through the @/ alias),
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
    verifyPharmacyPayment: jest.fn(),
    markPharmacyRefunded: jest.fn(),
  };
});

const mockedGetOrders = getPharmacyDashboardOrders as jest.Mock;
const mockedRestore = restorePharmacyOrder as jest.Mock;
const mockedTransition = transitionPharmacyOrder as jest.Mock;
const mockedVerify = verifyPharmacyPayment as jest.Mock;
const mockedRefunded = markPharmacyRefunded as jest.Mock;

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

describe("Pharmacy dashboard orders — mobile money", () => {
  const momo: PharmacyOrder = {
    id: "order-9",
    pharmacyId: "pharmacy-1",
    status: "accepted",
    fulfillmentMethod: "delivery",
    productSubtotal: 300,
    deliveryFee: 150,
    platformFee: 0,
    finalTotal: 450,
    createdAt: new Date().toISOString(),
    paymentMethod: "mtn_momo",
    paymentStatus: "awaiting_verification",
    paymentReference: "MP240115.1234",
    paymentAccount: "0886 000 111",
    contactPhone: "0770 123 456",
    deliveryAddress: "Behind the blue church, Sinkor",
  };

  beforeEach(() => {
    mockedGetOrders.mockReset();
    mockedVerify.mockReset();
    mockedRefunded.mockReset();
    mockedTransition.mockReset();
  });

  it("shows the transaction ID and holds preparing until the payment is confirmed", async () => {
    mockedGetOrders.mockResolvedValue([momo]);
    renderPage();

    expect(await screen.findByText("MP240115.1234")).toBeInTheDocument();
    expect(screen.getByText(/behind the blue church/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "0770 123 456" })).toHaveAttribute("href", "tel:0770123456");
    expect(screen.getByRole("button", { name: /mark preparing/i })).toBeDisabled();
    expect(screen.getByText(/confirm the mobile money payment before preparing/i)).toBeInTheDocument();
  });

  it("confirms a payment and reloads", async () => {
    mockedGetOrders.mockResolvedValueOnce([momo]).mockResolvedValueOnce([{ ...momo, paymentStatus: "paid" }]);
    mockedVerify.mockResolvedValue({ ...momo, paymentStatus: "paid" });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /payment received/i }));
    await waitFor(() => expect(mockedVerify).toHaveBeenCalledWith("pharmacy-1", "order-9", true));
    await waitFor(() => expect(screen.getByRole("button", { name: /mark preparing/i })).toBeEnabled());
  });

  it("offers Mark refunded once a paid order is cancelled", async () => {
    mockedGetOrders.mockResolvedValue([{ ...momo, status: "cancelled", paymentStatus: "refund_due" }]);
    mockedRefunded.mockResolvedValue({});
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /mark refunded/i }));
    await waitFor(() => expect(mockedRefunded).toHaveBeenCalledWith("pharmacy-1", "order-9"));
  });
});
