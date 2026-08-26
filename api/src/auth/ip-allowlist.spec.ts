import { isIpAllowed } from "./ip-allowlist";

describe("isIpAllowed", () => {
  it("allows anything when the allowlist is empty (unconfigured = no restriction)", () => {
    expect(isIpAllowed("1.2.3.4", [])).toBe(true);
    expect(isIpAllowed(null, [])).toBe(true);
  });

  it("fails closed on a null ip once an allowlist is configured", () => {
    expect(isIpAllowed(null, ["1.2.3.4"])).toBe(false);
  });

  it("matches an exact IP", () => {
    expect(isIpAllowed("203.0.113.5", ["203.0.113.5"])).toBe(true);
    expect(isIpAllowed("203.0.113.6", ["203.0.113.5"])).toBe(false);
  });

  it("matches a CIDR range", () => {
    expect(isIpAllowed("203.0.113.42", ["203.0.113.0/24"])).toBe(true);
    expect(isIpAllowed("203.0.114.1", ["203.0.113.0/24"])).toBe(false);
  });

  it("matches a /32 as an exact address", () => {
    expect(isIpAllowed("203.0.113.5", ["203.0.113.5/32"])).toBe(true);
    expect(isIpAllowed("203.0.113.6", ["203.0.113.5/32"])).toBe(false);
  });

  it("matches a /0 as everything", () => {
    expect(isIpAllowed("8.8.8.8", ["0.0.0.0/0"])).toBe(true);
  });

  it("checks every entry — a match on any one is enough", () => {
    const allowlist = ["10.0.0.0/8", "203.0.113.5"];
    expect(isIpAllowed("10.1.2.3", allowlist)).toBe(true);
    expect(isIpAllowed("203.0.113.5", allowlist)).toBe(true);
    expect(isIpAllowed("198.51.100.1", allowlist)).toBe(false);
  });

  it("never matches a malformed entry, rather than throwing or matching everything", () => {
    expect(isIpAllowed("203.0.113.5", ["not-an-ip"])).toBe(false);
    expect(isIpAllowed("203.0.113.5", ["203.0.113.0/40"])).toBe(false);
    expect(isIpAllowed("203.0.113.5", ["203.0.113.0/-1"])).toBe(false);
  });

  it("treats an unparseable ip as not matching a CIDR entry", () => {
    expect(isIpAllowed("not-an-ip", ["203.0.113.0/24"])).toBe(false);
  });

  it("supports an IPv6 address only as an exact match", () => {
    expect(isIpAllowed("::1", ["::1"])).toBe(true);
    expect(isIpAllowed("::2", ["::1"])).toBe(false);
  });
});
