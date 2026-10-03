import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DeliveryPaymentSettings } from "./DeliveryPaymentSettings";
import { defaultMenuSettings } from "@/lib/food-ordering";

const mockUpdate = jest.fn();
jest.mock("../../lib/menu-items-api", () => ({
  updateMenuSettings: (...a: unknown[]) => mockUpdate(...a),
}));

beforeEach(() => mockUpdate.mockReset());

describe("DeliveryPaymentSettings", () => {
  it("saves delivery with a fee and Orange Money", async () => {
    const onSaved = jest.fn();
    mockUpdate.mockImplementation(async (_t: string, businessId: string, input: object) => ({
      ...defaultMenuSettings(businessId),
      ...input,
    }));
    render(<DeliveryPaymentSettings token="tok" settings={defaultMenuSettings("biz-1")} onSaved={onSaved} />);

    fireEvent.click(screen.getByRole("checkbox", { name: /Delivery/ }));
    fireEvent.change(screen.getByRole("spinbutton", { name: /Delivery fee/ }), { target: { value: "2" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Areas you deliver to/ }), {
      target: { value: "Sinkor, Congo Town" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Orange Money number/ }), {
      target: { value: "0777 123 456" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save delivery & payments" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Add the name on your mobile money account");
    expect(mockUpdate).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("textbox", { name: /Name on the account/ }), {
      target: { value: "Mama's Kitchen" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save delivery & payments" }));
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        "tok",
        "biz-1",
        expect.objectContaining({
          deliveryEnabled: true,
          deliveryFee: 2,
          freeDeliveryMinimum: null,
          deliveryAreas: "Sinkor, Congo Town",
          orangeMoneyNumber: "0777 123 456",
          mobileMoneyName: "Mama's Kitchen",
        }),
      ),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
    expect(onSaved).toHaveBeenCalled();
  });

  it("won't save with no way to receive food or payment", () => {
    render(<DeliveryPaymentSettings token="tok" settings={defaultMenuSettings("biz-1")} onSaved={jest.fn()} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Pickup/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save delivery & payments" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Offer at least one of pickup or delivery");
    fireEvent.click(screen.getByRole("checkbox", { name: /Pickup/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Cash on delivery/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save delivery & payments" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Accept at least one payment method");
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
