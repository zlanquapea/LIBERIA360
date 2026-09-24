import { normalizePhoneOrThrow, parseAndNormalizePhone } from "./phone";

describe("phone normalization", () => {
  it("normalizes Liberia local numbers to E.164", () => {
    expect(parseAndNormalizePhone("077 123 4567")).toBe("+231771234567");
  });

  it("normalizes international numbers without changing their country", () => {
    expect(parseAndNormalizePhone("+1 (415) 555-2671")).toBe("+14155552671");
  });

  it("returns null for an omitted or cleared optional value", () => {
    expect(parseAndNormalizePhone(undefined)).toBeNull();
    expect(parseAndNormalizePhone("   ")).toBeNull();
  });

  it("rejects invalid values with a client-safe error", () => {
    expect(() => normalizePhoneOrThrow("12345")).toThrow(
      "Phone number must be a valid phone number",
    );
  });
});
