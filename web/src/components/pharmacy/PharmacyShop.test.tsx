import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PharmacyShop } from "./PharmacyShop";
import { createPharmacyOrder, uploadPrescription } from "@/lib/pharmacy-api";
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
  };
});

const mockedUpload = uploadPrescription as jest.Mock;
const mockedCreateOrder = createPharmacyOrder as jest.Mock;

const pharmacy: Pharmacy = {
  id: "pharmacy-1",
  name: "Test Pharmacy",
  slug: "test-pharmacy",
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
  });
});
