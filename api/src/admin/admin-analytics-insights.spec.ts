import { buildInsights, buildTrend } from "./admin-analytics-insights";
import type { TopPlace } from "./admin-analytics.service";

describe("buildTrend", () => {
  it("computes a positive delta and 'up' direction for real growth", () => {
    const trend = buildTrend("newUsers", "New sign-ups", 22, 20);
    expect(trend.deltaPct).toBeCloseTo(10, 5);
    expect(trend.direction).toBe("up");
  });

  it("computes a negative delta and 'down' direction for a real drop", () => {
    const trend = buildTrend("newReviews", "New reviews", 5, 20);
    expect(trend.deltaPct).toBeCloseTo(-75, 5);
    expect(trend.direction).toBe("down");
  });

  it("stays 'flat' for a swing under the 5% noise threshold", () => {
    const trend = buildTrend("newBookings", "New booking requests", 104, 100);
    expect(trend.direction).toBe("flat");
  });

  it("treats exactly 5% as a real move, not noise", () => {
    const trend = buildTrend("newBookings", "New booking requests", 21, 20);
    expect(trend.direction).toBe("up");
  });

  it("reports deltaPct as null when there's nothing to compare against", () => {
    const trend = buildTrend("pageViews", "Place page views", 12, 0);
    expect(trend.deltaPct).toBeNull();
  });

  it("still reads as 'up' from a zero baseline without a fake percentage", () => {
    const trend = buildTrend("pageViews", "Place page views", 12, 0);
    expect(trend.direction).toBe("up");
  });

  it("stays 'flat' when both periods are zero", () => {
    const trend = buildTrend("newBookings", "New booking requests", 0, 0);
    expect(trend.direction).toBe("flat");
    expect(trend.deltaPct).toBeNull();
  });
});

describe("buildInsights", () => {
  const place: TopPlace = {
    placeId: "p1",
    name: "CeeCee Beach",
    slug: "ceecee-beach",
    views: 40,
    saves: 5,
    contactClicks: 2,
    bookingRequests: 1,
    total: 48,
  };

  it("calls out growth for an 'up' metric", () => {
    const trend = buildTrend("newUsers", "New sign-ups", 22, 20);
    const insights = buildInsights([trend], [], 0);
    expect(insights).toContain(
      "New sign-ups grew 10% vs. the previous period.",
    );
  });

  it("calls out a decline for a 'down' metric, flagged as worth a look", () => {
    const trend = buildTrend("newReviews", "New reviews", 5, 20);
    const insights = buildInsights([trend], [], 0);
    expect(insights).toContain(
      "New reviews dropped 75% vs. the previous period — worth a look.",
    );
  });

  it("names the top-performing place when one exists", () => {
    const insights = buildInsights([], [place], 0);
    expect(insights).toContain(
      '"CeeCee Beach" is your top-performing place this period.',
    );
  });

  it("flags neglected places, singular vs. plural", () => {
    expect(buildInsights([], [], 1)).toContain(
      "1 catalog place got zero views this period — consider featuring or reviewing it.",
    );
    expect(buildInsights([], [], 3)).toContain(
      "3 catalog places got zero views this period — consider featuring or reviewing them.",
    );
  });

  it("falls back to a single honest line when there's nothing to report", () => {
    const flat = buildTrend("newBookings", "New booking requests", 0, 0);
    expect(buildInsights([flat], [], 0)).toEqual([
      "No new booking requests recorded in this period yet.",
    ]);
  });

  it("never fabricates an insight when metrics/places/neglected are all empty", () => {
    expect(buildInsights([], [], 0)).toEqual([
      "Not enough activity yet this period to surface a trend.",
    ]);
  });
});
