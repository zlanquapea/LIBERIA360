import type { MetricTrend, TopPlace } from "./admin-analytics.service";

/** Pure, dependency-free — deliberately split out of AdminAnalyticsService
 * so this rule-based logic (thresholds and sentence templates) is
 * unit-testable without standing up five mocked repositories. */
export function buildTrend(
  key: MetricTrend["key"],
  label: string,
  current: number,
  previous: number,
): MetricTrend {
  const deltaPct =
    previous > 0 ? ((current - previous) / previous) * 100 : null;
  // A period with only single-digit counts (typical for a young platform)
  // shouldn't announce a "50% jump" off a swing of one or two — direction
  // only reads as up/down once the pct move is large enough to mean
  // something, otherwise it's "flat" even if the raw numbers technically
  // differ.
  let direction: MetricTrend["direction"] = "flat";
  if (deltaPct !== null && Math.abs(deltaPct) >= 5) {
    direction = deltaPct > 0 ? "up" : "down";
  } else if (deltaPct === null && current > previous) {
    direction = "up";
  }
  return { key, label, current, previous, deltaPct, direction };
}

export function buildInsights(
  metrics: MetricTrend[],
  topPlaces: TopPlace[],
  neglectedCount: number,
): string[] {
  const insights: string[] = [];
  for (const metric of metrics) {
    if (metric.direction === "up" && metric.deltaPct !== null) {
      insights.push(
        `${metric.label} grew ${metric.deltaPct.toFixed(0)}% vs. the previous period.`,
      );
    } else if (metric.direction === "down" && metric.deltaPct !== null) {
      insights.push(
        `${metric.label} dropped ${Math.abs(metric.deltaPct).toFixed(0)}% vs. the previous period — worth a look.`,
      );
    } else if (metric.current === 0 && metric.previous === 0) {
      insights.push(
        `No ${metric.label.toLowerCase()} recorded in this period yet.`,
      );
    }
  }
  if (topPlaces.length > 0) {
    insights.push(
      `"${topPlaces[0].name}" is your top-performing place this period.`,
    );
  }
  if (neglectedCount > 0) {
    insights.push(
      `${neglectedCount} catalog place${neglectedCount === 1 ? "" : "s"} got zero views this period — consider featuring or reviewing ${neglectedCount === 1 ? "it" : "them"}.`,
    );
  }
  if (insights.length === 0) {
    insights.push("Not enough activity yet this period to surface a trend.");
  }
  return insights;
}
