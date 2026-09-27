import { normalizePhoneInput, phoneInputError } from "./phone-validation";

describe("phone validation", () => {
  it("accepts and normalizes Liberia local numbers", () => {
    expect(normalizePhoneInput("077 123 4567")).toBe("+231771234567");
    expect(phoneInputError("077 123 4567")).toBeNull();
  });

  it("accepts international numbers", () => {
    expect(normalizePhoneInput("+1 (415) 555-2671")).toBe("+14155552671");
  });

  it("returns a helpful hint for invalid non-empty input", () => {
    expect(phoneInputError("12345")).toContain("Enter a valid phone number");
    expect(normalizePhoneInput("12345")).toBeNull();
  });

  it("allows an optional phone field to remain empty", () => {
    expect(phoneInputError("   ")).toBeNull();
    expect(normalizePhoneInput("   ")).toBeNull();
  });
});
