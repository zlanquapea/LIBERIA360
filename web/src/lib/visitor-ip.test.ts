import { proxySecret, trustedProxyHops, visitorIpFromForwardedFor } from "./visitor-ip";

describe("visitorIpFromForwardedFor", () => {
  it("returns nothing when there is no header", () => {
    expect(visitorIpFromForwardedFor(null, 1)).toBeUndefined();
    expect(visitorIpFromForwardedFor("", 1)).toBeUndefined();
  });

  it("takes the entry appended by the nearest proxy, not the client's own first entry", () => {
    // A client can send any X-Forwarded-For it likes; the load balancer
    // appends the address it actually received the request from.
    expect(visitorIpFromForwardedFor("1.2.3.4, 203.0.113.9", 1)).toBe("203.0.113.9");
    expect(visitorIpFromForwardedFor("203.0.113.9", 1)).toBe("203.0.113.9");
  });

  it("counts back one entry per trusted proxy", () => {
    // visitor -> CDN -> load balancer -> web: the CDN appended the visitor,
    // the load balancer appended the CDN.
    expect(visitorIpFromForwardedFor("1.2.3.4, 203.0.113.9, 172.16.0.1", 2)).toBe(
      "203.0.113.9",
    );
  });

  it("uses the rightmost entry with no proxy in front (Next fills in the socket address)", () => {
    expect(visitorIpFromForwardedFor("::ffff:127.0.0.1", 0)).toBe("::ffff:127.0.0.1");
  });

  it("returns nothing when the chain is shorter than the configured hops", () => {
    expect(visitorIpFromForwardedFor("203.0.113.9", 2)).toBeUndefined();
  });

  it("rejects anything that isn't shaped like an IP address", () => {
    expect(visitorIpFromForwardedFor("unknown", 1)).toBeUndefined();
    expect(visitorIpFromForwardedFor("203.0.113.9\r\nx-evil: 1", 1)).toBeUndefined();
  });

  it("accepts IPv6", () => {
    expect(visitorIpFromForwardedFor("2001:db8::1", 1)).toBe("2001:db8::1");
  });
});

describe("env helpers", () => {
  const ORIGINAL_ENV = process.env;
  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("defaults to one trusted proxy and honours TRUST_PROXY_HOPS", () => {
    process.env = { ...ORIGINAL_ENV, TRUST_PROXY_HOPS: undefined };
    expect(trustedProxyHops()).toBe(1);
    process.env = { ...ORIGINAL_ENV, TRUST_PROXY_HOPS: "2" };
    expect(trustedProxyHops()).toBe(2);
    process.env = { ...ORIGINAL_ENV, TRUST_PROXY_HOPS: "nonsense" };
    expect(trustedProxyHops()).toBe(1);
  });

  it("ignores a missing or too-short INTERNAL_PROXY_SECRET", () => {
    process.env = { ...ORIGINAL_ENV, INTERNAL_PROXY_SECRET: undefined };
    expect(proxySecret()).toBeUndefined();
    process.env = { ...ORIGINAL_ENV, INTERNAL_PROXY_SECRET: "short" };
    expect(proxySecret()).toBeUndefined();
    process.env = { ...ORIGINAL_ENV, INTERNAL_PROXY_SECRET: "s".repeat(32) };
    expect(proxySecret()).toBe("s".repeat(32));
  });
});
