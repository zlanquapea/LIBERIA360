import { isOpenAt, parseOpeningHoursText } from "./opening-hours";

// All times below are UTC, which is also Liberia local time — see
// isOpenAt's doc comment.
function at(isoWithoutZone: string): Date {
  return new Date(`${isoWithoutZone}Z`);
}

describe("parseOpeningHoursText", () => {
  it("returns null for empty/missing input", () => {
    expect(parseOpeningHoursText(null)).toBeNull();
    expect(parseOpeningHoursText(undefined)).toBeNull();
    expect(parseOpeningHoursText("")).toBeNull();
    expect(parseOpeningHoursText("   ")).toBeNull();
  });

  it("parses a day-range + 24h time range", () => {
    expect(parseOpeningHoursText("Mon-Fri 9:00-18:00")).toEqual([
      { dayOfWeek: 1, opens: "09:00", closes: "18:00" },
      { dayOfWeek: 2, opens: "09:00", closes: "18:00" },
      { dayOfWeek: 3, opens: "09:00", closes: "18:00" },
      { dayOfWeek: 4, opens: "09:00", closes: "18:00" },
      { dayOfWeek: 5, opens: "09:00", closes: "18:00" },
    ]);
  });

  it("parses am/pm times", () => {
    expect(parseOpeningHoursText("Sat 9am-2pm")).toEqual([
      { dayOfWeek: 6, opens: "09:00", closes: "14:00" },
    ]);
  });

  it("parses 12am/12pm as midnight/noon", () => {
    expect(parseOpeningHoursText("Sun 12am-12pm")).toEqual([
      { dayOfWeek: 0, opens: "00:00", closes: "12:00" },
    ]);
  });

  it("parses 'Daily' and 'Every day' as all seven days", () => {
    expect(parseOpeningHoursText("Daily 8:00-20:00")).toHaveLength(7);
    expect(parseOpeningHoursText("Every day 8:00-20:00")).toHaveLength(7);
  });

  it("parses comma-separated segments", () => {
    const result = parseOpeningHoursText("Mon-Fri 9:00-18:00, Sat 10:00-14:00");
    expect(result).toHaveLength(6);
    expect(result).toContainEqual({
      dayOfWeek: 6,
      opens: "10:00",
      closes: "14:00",
    });
  });

  it("wraps a day range across the week boundary", () => {
    const result = parseOpeningHoursText("Fri-Sun 18:00-23:00");
    expect(result?.map((p) => p.dayOfWeek).sort()).toEqual([0, 5, 6]);
  });

  it("recognizes 24/7 and 24 hours as always open", () => {
    expect(parseOpeningHoursText("24/7")).toHaveLength(7);
    expect(parseOpeningHoursText("Open 24 hours")).toEqual(
      expect.arrayContaining([
        { dayOfWeek: 0, opens: "00:00", closes: "24:00" },
      ]),
    );
  });

  it("is case-insensitive", () => {
    expect(parseOpeningHoursText("MON-FRI 9AM-6PM")).toHaveLength(5);
  });

  it("returns null for unrecognized freeform text rather than guessing", () => {
    expect(
      parseOpeningHoursText("Closed Sundays, call ahead for holidays"),
    ).toBeNull();
    expect(parseOpeningHoursText("By appointment only")).toBeNull();
  });

  it("returns null if any one comma-separated segment fails to parse", () => {
    expect(
      parseOpeningHoursText("Mon-Fri 9:00-18:00, closed Sundays"),
    ).toBeNull();
  });
});

describe("isOpenAt", () => {
  const weekdayHours = parseOpeningHoursText("Mon-Fri 9:00-18:00")!;

  it("returns false for null/empty hours", () => {
    expect(isOpenAt(null, new Date())).toBe(false);
    expect(isOpenAt([], new Date())).toBe(false);
  });

  it("is true inside the window on a matching day", () => {
    // 2026-08-24 is a Monday
    expect(isOpenAt(weekdayHours, at("2026-08-24T12:00:00"))).toBe(true);
  });

  it("is false before opening and at/after closing", () => {
    expect(isOpenAt(weekdayHours, at("2026-08-24T08:59:00"))).toBe(false);
    expect(isOpenAt(weekdayHours, at("2026-08-24T18:00:00"))).toBe(false);
  });

  it("is false on a day not listed", () => {
    // 2026-08-22 is a Saturday
    expect(isOpenAt(weekdayHours, at("2026-08-22T12:00:00"))).toBe(false);
  });

  it("handles a period that wraps past midnight", () => {
    const nightlife = parseOpeningHoursText("Fri 20:00-2:00")!;
    // Still Friday, well after opening
    expect(isOpenAt(nightlife, at("2026-08-21T23:00:00"))).toBe(true);
    // Saturday 01:00 — still within Friday's overnight window
    expect(isOpenAt(nightlife, at("2026-08-22T01:00:00"))).toBe(true);
    // Saturday 03:00 — past the wrapped closing time
    expect(isOpenAt(nightlife, at("2026-08-22T03:00:00"))).toBe(false);
    // Friday 19:00 — before opening
    expect(isOpenAt(nightlife, at("2026-08-21T19:00:00"))).toBe(false);
  });

  it("treats 24/7 as always open", () => {
    const allDay = parseOpeningHoursText("24/7")!;
    expect(isOpenAt(allDay, at("2026-08-24T03:00:00"))).toBe(true);
    expect(isOpenAt(allDay, at("2026-08-24T23:59:00"))).toBe(true);
  });
});
