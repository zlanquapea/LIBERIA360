import {
  addDays,
  eachNight,
  nightlyUse,
  nightsBetween,
  reservationCode,
  roomsLeft,
} from "./availability";

describe("stay availability", () => {
  it("counts nights, not days", () => {
    expect(nightsBetween("2026-10-10", "2026-10-12")).toBe(2);
    expect(eachNight("2026-10-30", "2026-11-02")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("frees a room on the morning the guest leaves", () => {
    const stays = [{ checkIn: "2026-10-10", checkOut: "2026-10-12", rooms: 1 }];
    // Arriving the day the other guest leaves: no clash.
    expect(roomsLeft(1, "2026-10-12", "2026-10-14", stays)).toBe(1);
    // Arriving the night before they leave: clash.
    expect(roomsLeft(1, "2026-10-11", "2026-10-13", stays)).toBe(0);
  });

  it("uses the busiest night of the stay, including blocked rooms", () => {
    const stays = [
      { checkIn: "2026-10-10", checkOut: "2026-10-11", rooms: 2 },
      { checkIn: "2026-10-11", checkOut: "2026-10-13", rooms: 1 },
    ];
    const blocks = [
      { startDate: "2026-10-12", endDate: "2026-10-12", rooms: 3 },
    ];
    expect(nightlyUse("2026-10-10", "2026-10-13", stays, blocks)).toEqual({
      booked: [2, 1, 1],
      blocked: [0, 0, 3],
    });
    expect(roomsLeft(5, "2026-10-10", "2026-10-13", stays, blocks)).toBe(1);
    expect(roomsLeft(3, "2026-10-10", "2026-10-13", stays, blocks)).toBe(0);
  });

  it("makes readable codes without look-alike characters", () => {
    const code = reservationCode();
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    expect(code).not.toMatch(/[01IOL]/);
  });
});
