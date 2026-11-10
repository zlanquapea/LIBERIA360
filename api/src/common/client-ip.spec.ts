import type { Request } from "express";
import {
  CLIENT_IP_HEADER,
  PROXY_SECRET_HEADER,
  resolveClientIp,
} from "./client-ip";

const SECRET = "s".repeat(48);

function req(headers: Record<string, string>, ip = "10.0.0.7"): Request {
  return { ip, headers } as unknown as Request;
}

describe("resolveClientIp", () => {
  const original = process.env.INTERNAL_PROXY_SECRET;

  beforeEach(() => {
    process.env.INTERNAL_PROXY_SECRET = SECRET;
  });

  afterAll(() => {
    if (original === undefined) delete process.env.INTERNAL_PROXY_SECRET;
    else process.env.INTERNAL_PROXY_SECRET = original;
  });

  it("uses the forwarded visitor address when the shared secret matches", () => {
    expect(
      resolveClientIp(
        req({
          [CLIENT_IP_HEADER]: "203.0.113.9",
          [PROXY_SECRET_HEADER]: SECRET,
        }),
      ),
    ).toBe("203.0.113.9");
    expect(
      resolveClientIp(
        req({
          [CLIENT_IP_HEADER]: "2001:db8::1",
          [PROXY_SECRET_HEADER]: SECRET,
        }),
      ),
    ).toBe("2001:db8::1");
  });

  it("ignores the forwarded address without the secret", () => {
    expect(resolveClientIp(req({ [CLIENT_IP_HEADER]: "203.0.113.9" }))).toBe(
      "10.0.0.7",
    );
  });

  it("ignores the forwarded address with a wrong secret", () => {
    expect(
      resolveClientIp(
        req({
          [CLIENT_IP_HEADER]: "203.0.113.9",
          [PROXY_SECRET_HEADER]: "x".repeat(48),
        }),
      ),
    ).toBe("10.0.0.7");
    expect(
      resolveClientIp(
        req({
          [CLIENT_IP_HEADER]: "203.0.113.9",
          [PROXY_SECRET_HEADER]: "short",
        }),
      ),
    ).toBe("10.0.0.7");
  });

  it("never trusts the header when no secret is configured", () => {
    delete process.env.INTERNAL_PROXY_SECRET;
    expect(
      resolveClientIp(
        req({ [CLIENT_IP_HEADER]: "203.0.113.9", [PROXY_SECRET_HEADER]: "" }),
      ),
    ).toBe("10.0.0.7");
  });

  it("treats a too-short configured secret as not configured", () => {
    process.env.INTERNAL_PROXY_SECRET = "short";
    expect(
      resolveClientIp(
        req({
          [CLIENT_IP_HEADER]: "203.0.113.9",
          [PROXY_SECRET_HEADER]: "short",
        }),
      ),
    ).toBe("10.0.0.7");
  });

  it("falls back to the connecting address when the forwarded value is not an IP", () => {
    expect(
      resolveClientIp(
        req({ [CLIENT_IP_HEADER]: "not-an-ip", [PROXY_SECRET_HEADER]: SECRET }),
      ),
    ).toBe("10.0.0.7");
    expect(resolveClientIp(req({ [PROXY_SECRET_HEADER]: SECRET }))).toBe(
      "10.0.0.7",
    );
  });
});
