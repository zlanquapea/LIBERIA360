/**
 * Structured opening hours (external consultant review, Aug 2026 — the
 * next item after search/map/icons): `Place.openingHours` is free text
 * (e.g. "Mon-Fri 9am-6pm"), which is fine for display but can't be
 * filtered or queried against — there's no way to ask "what's open right
 * now" over a paragraph of prose. This adds a parallel structured
 * representation, `Place.structuredHours`, computed from that same free
 * text on a best-effort basis (see parseOpeningHoursText below), with the
 * free text kept as-is for display — it's still what a human reads on the
 * place page, structuredHours is only ever used for filtering/computation.
 *
 * Deliberately conservative: this recognizes a handful of common phrasings
 * ("Mon-Fri 9:00-18:00", "Daily 8am-8pm", "24/7", comma-separated
 * combinations of those) and returns null for anything else — "closed
 * Sundays, call ahead on holidays" stays free text only rather than being
 * half-parsed into something wrong. A missing/unparseable value means
 * "we don't know," which is the correct, conservative default for an
 * open-now filter — it should never claim a place is open when it
 * genuinely doesn't know its hours.
 */

// 0 = Sunday .. 6 = Saturday, matching JS Date's getUTCDay() — see isOpenAt's
// comment on why the UTC methods are used directly instead of converting to
// a Liberia-local time first.
export interface OpeningPeriod {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  opens: string; // "HH:MM", 24-hour, e.g. "09:00"
  closes: string; // "HH:MM", 24-hour, e.g. "18:00" or "24:00" for midnight/end-of-day. closes <= opens means the period runs past midnight into the next day (e.g. a nightclub open 20:00-02:00).
}

export type StructuredHours = OpeningPeriod[];

const DAY_INDEX: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  weds: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

const SEGMENT_RE =
  /^(?:(daily|every ?day|all days)|([a-z]+)(?:\s*-\s*([a-z]+))?)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)$/;

function parseTime(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const minute = m[2] ? parseInt(m[2], 10) : 0;
  const meridiem = m[3] as "am" | "pm" | undefined;
  if (minute < 0 || minute > 59) return null;

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    hour =
      meridiem === "am"
        ? hour === 12
          ? 0
          : hour
        : hour === 12
          ? 12
          : hour + 12;
  } else {
    if (hour === 24 && minute === 0) return "24:00"; // end-of-day marker
    if (hour < 0 || hour > 23) return null;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function expandDayRange(startKey: string, endKey?: string): number[] | null {
  const start = DAY_INDEX[startKey];
  if (start === undefined) return null;
  if (!endKey) return [start];
  const end = DAY_INDEX[endKey];
  if (end === undefined) return null;
  const days: number[] = [];
  let d = start;
  for (let i = 0; i < 7; i++) {
    days.push(d);
    if (d === end) break;
    d = (d + 1) % 7;
  }
  return days;
}

function parseSegment(segment: string): OpeningPeriod[] | null {
  const m = segment.match(SEGMENT_RE);
  if (!m) return null;
  const [, dailyKeyword, startDay, endDay, opensRaw, closesRaw] = m;
  const opens = parseTime(opensRaw);
  const closes = parseTime(closesRaw);
  if (!opens || !closes) return null;

  const days = dailyKeyword
    ? [0, 1, 2, 3, 4, 5, 6]
    : expandDayRange(startDay, endDay);
  if (!days) return null;

  return days.map((d) => ({
    dayOfWeek: d as OpeningPeriod["dayOfWeek"],
    opens,
    closes,
  }));
}

export function parseOpeningHoursText(
  text: string | null | undefined,
): StructuredHours | null {
  if (!text) return null;
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;

  if (/24\s*\/\s*7|24\s*hours?|around the clock/.test(normalized)) {
    return [0, 1, 2, 3, 4, 5, 6].map((d) => ({
      dayOfWeek: d as OpeningPeriod["dayOfWeek"],
      opens: "00:00",
      closes: "24:00",
    }));
  }

  const segments = normalized
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return null;

  const periods: OpeningPeriod[] = [];
  for (const segment of segments) {
    const parsed = parseSegment(segment);
    // Any one unrecognized segment means the whole string didn't parse
    // cleanly — better to fall back to "unknown" than guess at half of it.
    if (!parsed) return null;
    periods.push(...parsed);
  }
  return periods.length > 0 ? periods : null;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Liberia Standard Time is UTC+0 year-round (no daylight saving), so a
// server's UTC clock already reads as Monrovia local time — no timezone
// conversion needed, which is why this reads straight off `at`'s UTC
// getters rather than converting to a specific zone first.
export function isOpenAt(
  hours: StructuredHours | null | undefined,
  at: Date,
): boolean {
  if (!hours || hours.length === 0) return false;
  const day = at.getUTCDay();
  const prevDay = (day + 6) % 7;
  const minutesNow = at.getUTCHours() * 60 + at.getUTCMinutes();

  for (const period of hours) {
    const opensMin = toMinutes(period.opens);
    const closesMin = toMinutes(period.closes);
    const wrapsPastMidnight = closesMin <= opensMin;

    if (period.dayOfWeek === day) {
      if (!wrapsPastMidnight) {
        if (minutesNow >= opensMin && minutesNow < closesMin) return true;
      } else if (minutesNow >= opensMin) {
        return true;
      }
    }
    if (
      period.dayOfWeek === prevDay &&
      wrapsPastMidnight &&
      minutesNow < closesMin
    ) {
      return true;
    }
  }
  return false;
}
