import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { PharmacyShop } from "./PharmacyShop";
import {
  createPharmacyOrder,
  deleteUnattachedPrescription,
  uploadPrescription,
} from "@/lib/pharmacy-api";
import type { Pharmacy, PharmacyProduct } from "@/lib/pharmacy-api";

// jest.mock's module specifier is a plain string, not an import
// declaration — the '@/...' alias only gets resolved by SWC's transform
// on real import statements, so this needs the relative path to resolve
// to the same module PharmacyShop imports via '@/lib/pharmacy-api'.
jest.mock("../../lib/pharmacy-api", () => {
  const actual = jest.requireActual("../../lib/pharmacy-api");
  return {
    ...actual,
    uploadPrescription: jest.fn(),
    createPharmacyOrder: jest.fn(),
    deleteUnattachedPrescription: jest.fn(),
  };
});

const mockedUpload = uploadPrescription as jest.Mock;
const mockedCreateOrder = createPharmacyOrder as jest.Mock;
const mockedDeleteUnattached = deleteUnattachedPrescription as jest.Mock;

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

const rxProduct: PharmacyProduct = {
  id: "product-1",
  pharmacyId: "pharmacy-1",
  categoryId: "cat-1",
  name: "Amoxicillin",
  imageUrl: null,
  price: 10,
  prescriptionRequired: true,
  isVisible: true,
  inventory: { quantity: 5 },
};

const otcProduct: PharmacyProduct = {
  id: "product-2",
  pharmacyId: "pharmacy-1",
  categoryId: "cat-1",
  name: "Vitamin C",
  imageUrl: null,
  price: 5,
  prescriptionRequired: false,
  isVisible: true,
  inventory: { quantity: 20 },
};

function selectPrescriptionFile() {
  const file = new File(["x"], "script.jpg", { type: "image/jpeg" });
  const input = document.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

async function addToCartAndCheckout() {
  fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));
  selectPrescriptionFile();
  fireEvent.click(screen.getByRole("checkbox", { name: /i consent/i }));
  fireEvent.click(screen.getByRole("button", { name: /place order/i }));
}

describe("PharmacyShop checkout — prescription upload reuse", () => {
  beforeEach(() => {
    mockedUpload.mockReset();
    mockedCreateOrder.mockReset();
    mockedDeleteUnattached.mockReset().mockResolvedValue(undefined);
  });

  it("reuses the already-uploaded prescription on a retry instead of uploading another copy", async () => {
    mockedUpload.mockResolvedValue("rx-1");
    // First attempt: the order itself is rejected (e.g. stock changed) —
    // unrelated to the prescription upload, which already succeeded.
    mockedCreateOrder.mockRejectedValueOnce(new Error("Out of stock"));
    mockedCreateOrder.mockResolvedValueOnce({ id: "order-1" });

    render(
      <PharmacyShop
        pharmacy={pharmacy}
        products={[rxProduct]}
        categories={[{ id: "cat-1", name: "Antibiotics" }]}
      />,
    );

    await addToCartAndCheckout();
    await waitFor(() => expect(mockedCreateOrder).toHaveBeenCalledTimes(1));
    expect(mockedUpload).toHaveBeenCalledTimes(1);

    // Retry — same file is still selected, so the cached prescription id
    // must be reused rather than uploading a second copy.
    fireEvent.click(screen.getByRole("button", { name: /place order/i }));
    await waitFor(() => expect(mockedCreateOrder).toHaveBeenCalledTimes(2));

    expect(mockedUpload).toHaveBeenCalledTimes(1);
    expect(mockedCreateOrder).toHaveBeenLastCalledWith(
      expect.objectContaining({ prescriptionId: "rx-1" }),
    );
  });

  it("uploads fresh when the customer picks a different file after a failed attempt", async () => {
    mockedUpload.mockResolvedValueOnce("rx-1").mockResolvedValueOnce("rx-2");
    mockedCreateOrder.mockRejectedValueOnce(new Error("Out of stock"));
    mockedCreateOrder.mockResolvedValueOnce({ id: "order-1" });

    render(
      <PharmacyShop
        pharmacy={pharmacy}
        products={[rxProduct]}
        categories={[{ id: "cat-1", name: "Antibiotics" }]}
      />,
    );

    await addToCartAndCheckout();
    await waitFor(() => expect(mockedCreateOrder).toHaveBeenCalledTimes(1));

    // Customer picks a different file before retrying.
    const newFile = new File(["y"], "script2.jpg", { type: "image/jpeg" });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [newFile] } });
    fireEvent.click(screen.getByRole("button", { name: /place order/i }));

    await waitFor(() => expect(mockedCreateOrder).toHaveBeenCalledTimes(2));
    expect(mockedUpload).toHaveBeenCalledTimes(2);
    expect(mockedCreateOrder).toHaveBeenLastCalledWith(
      expect.objectContaining({ prescriptionId: "rx-2" }),
    );
    // The first upload (rx-1) is now orphaned — never attached to an
    // order, and no longer reachable via uploadedPrescriptionRef — so it
    // must be cleaned up rather than left behind.
    expect(mockedDeleteUnattached).toHaveBeenCalledWith("rx-1");
  });

  it("deletes the cached upload as soon as a different file is selected, even before any checkout retry", async () => {
    mockedUpload.mockResolvedValue("rx-1");
    // The order itself must not succeed here — a successful order clears
    // uploadedPrescriptionRef on its own (the prescription is now
    // legitimately attached), which would make this scenario impossible to
    // observe. Same "order fails, upload didn't" setup as the test above.
    mockedCreateOrder.mockRejectedValue(new Error("Out of stock"));

    render(
      <PharmacyShop
        pharmacy={pharmacy}
        products={[rxProduct]}
        categories={[{ id: "cat-1", name: "Antibiotics" }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));
    selectPrescriptionFile();
    fireEvent.click(screen.getByRole("checkbox", { name: /i consent/i }));
    fireEvent.click(screen.getByRole("button", { name: /place order/i }));
    await waitFor(() => expect(mockedUpload).toHaveBeenCalledTimes(1));

    const newFile = new File(["y"], "script2.jpg", { type: "image/jpeg" });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [newFile] } });

    await waitFor(() =>
      expect(mockedDeleteUnattached).toHaveBeenCalledWith("rx-1"),
    );
  });

  it("deletes the cached upload once the cart no longer needs a prescription, even without a file-change event", async () => {
    mockedUpload.mockResolvedValue("rx-1");
    // The first attempt (both items in cart) fails for an unrelated
    // reason — the upload succeeds and gets cached, the order doesn't.
    mockedCreateOrder.mockRejectedValueOnce(new Error("Out of stock"));
    mockedCreateOrder.mockResolvedValueOnce({ id: "order-1" });

    render(
      <PharmacyShop
        pharmacy={pharmacy}
        products={[rxProduct, otcProduct]}
        categories={[{ id: "cat-1", name: "Antibiotics" }]}
      />,
    );

    const rxCard = screen.getByText("Amoxicillin").closest("article")!;
    const otcCard = screen.getByText("Vitamin C").closest("article")!;
    fireEvent.click(within(rxCard).getByRole("button", { name: /add to cart/i }));
    fireEvent.click(within(otcCard).getByRole("button", { name: /add to cart/i }));
    selectPrescriptionFile();
    fireEvent.click(screen.getByRole("checkbox", { name: /i consent/i }));
    fireEvent.click(screen.getByRole("button", { name: /place order/i }));
    await waitFor(() => expect(mockedUpload).toHaveBeenCalledTimes(1));

    // Drop the only prescription-required item, keeping the OTC one — the
    // cart no longer needs a prescription at all, but nothing about the
    // file input changed, so handlePrescriptionFileChange never runs.
    fireEvent.click(
      screen.getByRole("button", { name: /remove all amoxicillin from cart/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /place order/i }));

    await waitFor(() =>
      expect(mockedDeleteUnattached).toHaveBeenCalledWith("rx-1"),
    );
    expect(mockedCreateOrder).toHaveBeenLastCalledWith(
      expect.objectContaining({ prescriptionId: undefined }),
    );
  });
});
