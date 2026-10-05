import { DataSource } from "typeorm";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AvailabilityAlertsController } from "./availability-alerts.controller";
import { AvailabilityAlertsService } from "./availability-alerts.service";
const date = "2026-11-01";
const guide = {
  title: "Coastal walk",
  guide_id: "guide",
  user_id: "owner",
  availability: {
    enabled: true,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    blockedDates: [date],
    version: 1,
  },
};
const alert = {
  id: "alert",
  user_id: "traveler",
  experience_id: "experience",
  date,
};
describe("Guide availability alerts", () => {
  const query = jest.fn();
  const db = {
    query,
    manager: { query },
    transaction: (fn: any) => fn({ query }),
  };
  const service = new AvailabilityAlertsService(db as unknown as DataSource);
  beforeEach(() => {
    query.mockReset();
    jest.useFakeTimers().setSystemTime(new Date("2026-10-04T12:00:00Z"));
  });
  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
  });
  it("requires signed-in access for all alert routes", () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AvailabilityAlertsController),
    ).toContain(JwtAuthGuard);
  });
  it("subscribes only to an unavailable, published experience", async () => {
    query
      .mockResolvedValueOnce([{ id: "traveler" }])
      .mockResolvedValueOnce([guide])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    expect(await service.subscribe("traveler", "experience", date)).toEqual({
      watching: true,
    });
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining("INSERT INTO guide_availability_alerts"),
      ["traveler", "experience", date],
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("g.verification_status = 'verified'"),
      ["experience"],
    );
  });
  it("rejects dates that are already available", async () => {
    query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { ...guide, availability: { ...guide.availability, blockedDates: [] } },
      ])
      .mockResolvedValueOnce([]);
    await expect(
      service.subscribe("traveler", "experience", date),
    ).rejects.toThrow("already available");
    expect(query).toHaveBeenCalledTimes(3);
  });
  it("makes repeat subscriptions idempotent", async () => {
    query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([guide])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([alert]);
    await service.subscribe("traveler", "experience", date);
    expect(query).toHaveBeenCalledTimes(4);
  });
  it("caps active subscriptions and serializes the limit check", async () => {
    query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([guide])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(
        Array.from({ length: 20 }, (_, id) => ({
          id,
          experience_id: "other",
          date,
        })),
      );
    await expect(
      service.subscribe("traveler", "experience", date),
    ).rejects.toThrow("20 dates");
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("FOR UPDATE"),
      ["traveler"],
    );
  });
  it.each(["2026-10-03", "2026-02-30", "2028-11-01"])(
    "rejects past, invalid, or distant date %s",
    async (invalid) => {
      await expect(
        service.subscribe("traveler", "experience", invalid),
      ).rejects.toThrow();
      expect(query).not.toHaveBeenCalled();
    },
  );
  it("removes only the signed-in user’s alert", async () => {
    query.mockResolvedValue([]);
    await service.remove("traveler", "alert");
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("id = $1 AND user_id = $2"),
      ["alert", "traveler"],
    );
  });
  it("does not notify while a different experience has booked the same guide", async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.startsWith("SELECT id, user_id")) return [alert];
      if (sql.startsWith("SELECT e.title"))
        return [
          {
            ...guide,
            availability: { ...guide.availability, blockedDates: [] },
          },
        ];
      if (sql.startsWith("SELECT b.id"))
        return [{ id: "other-experience-booking" }];
      return [];
    });
    await service.processAlerts();
    expect(
      query.mock.calls.some(([sql]) =>
        sql.startsWith("INSERT INTO notifications"),
      ),
    ).toBe(false);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("b.status = 'confirmed'"),
      ["guide", date],
    );
  });
  it("creates one durable notification when the date opens and does not repeat it", async () => {
    let notified = false;
    query.mockImplementation(async (sql: string) => {
      if (sql.startsWith("SELECT id, user_id")) return notified ? [] : [alert];
      if (sql.startsWith("SELECT e.title"))
        return [
          {
            ...guide,
            availability: { ...guide.availability, blockedDates: [] },
          },
        ];
      if (sql.includes("SET notified_at = NOW()")) notified = true;
      return [];
    });
    await service.processAlerts();
    await service.processAlerts();
    expect(
      query.mock.calls.filter(([sql]) =>
        sql.startsWith("INSERT INTO notifications"),
      ),
    ).toHaveLength(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("'booking.availability'"),
      [
        "traveler",
        expect.stringContaining("guide confirmation is required"),
        `/experiences/experience?date=${date}`,
      ],
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("FOR UPDATE SKIP LOCKED"),
    );
  });
  it("does not mark an alert delivered if notification insertion fails", async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.startsWith("SELECT id, user_id")) return [alert];
      if (sql.startsWith("SELECT e.title"))
        return [
          {
            ...guide,
            availability: { ...guide.availability, blockedDates: [] },
          },
        ];
      if (sql.startsWith("INSERT INTO notifications"))
        throw new Error("DB unavailable");
      return [];
    });
    await service.processAlerts();
    expect(
      query.mock.calls.some(([sql]) => sql.includes("SET notified_at = NOW()")),
    ).toBe(false);
  });
});
