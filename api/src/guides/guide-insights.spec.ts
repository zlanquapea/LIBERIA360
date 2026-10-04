import { DataSource } from "typeorm";
import { GuideInsightsService } from "./guide-insights.service";
import { GuideInsightsController } from "./guide-insights.controller";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
describe("Guide insights", () => {
  const query = jest.fn();
  const service = new GuideInsightsService({ query } as unknown as DataSource);
  beforeEach(() => query.mockReset());
  it("requires authentication for owner insights", () =>
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        GuideInsightsController.prototype.mine,
      ),
    ).toContain(JwtAuthGuard));
  it("rejects unsupported time windows", async () => {
    await expect(service.mine("user", 365)).rejects.toThrow("Choose 7");
    expect(query).not.toHaveBeenCalled();
  });
  it("does not read metrics when caller has no guide profile", async () => {
    query.mockResolvedValueOnce([]);
    expect(await service.mine("user", 30)).toEqual({ available: false });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("user_id=$1"), [
      "user",
    ]);
  });
  it("fills missing days and uses actual booking records", async () => {
    const date = new Date().toISOString().slice(0, 10);
    query
      .mockResolvedValueOnce([{ id: "own-guide" }])
      .mockResolvedValueOnce([{ date, profile_views: 2, experience_views: 3 }])
      .mockResolvedValueOnce([{ date, booking_requests: 1 }])
      .mockResolvedValueOnce([]);
    const result = await service.mine("owner", 7);
    expect(result.byDay).toHaveLength(7);
    expect(result.totals).toEqual({
      profile_views: 2,
      experience_views: 3,
      booking_requests: 1,
    });
    for (const call of query.mock.calls.slice(1))
      expect(call[1][0]).toBe("own-guide");
    expect(query.mock.calls[2][0]).toContain("guide_bookings");
  });
  it("rejects ambiguous tracking targets", async () => {
    await expect(service.record("id", "guide", "exp")).rejects.toThrow(
      "Choose one",
    );
    expect(query).not.toHaveBeenCalled();
  });
  it("rejects unpublished or unverified targets without recording", async () => {
    query.mockResolvedValueOnce([]);
    await expect(service.record("id", undefined, "exp")).rejects.toThrow(
      "Public",
    );
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain("e.status='published'");
  });
  it("deduplicates retries with the same event id", async () => {
    query.mockResolvedValueOnce([{ id: "guide" }]).mockResolvedValueOnce([]);
    await service.record("event", undefined, "exp");
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining("ON CONFLICT(id) DO NOTHING"),
      ["event", "guide", "exp"],
    );
  });
});
