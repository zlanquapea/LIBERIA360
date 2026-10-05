import { DataSource, EntityManager } from "typeorm";
import {
  TripActivityService,
  recordTripActivity,
} from "./trip-activity.service";
import { TripActivityController } from "./trip-activity.controller";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { TripVotingService } from "./trip-voting.service";
import { ItinerariesService } from "./itineraries.service";
describe("Trip activity privacy and delivery", () => {
  const query = jest.fn();
  const m = { query } as unknown as EntityManager;
  const db = {
    manager: m,
    query,
    transaction: async (fn: any) => fn(m),
  } as unknown as DataSource;
  const service = new TripActivityService(db);
  beforeEach(() => query.mockReset());
  it("authenticates all activity routes", () =>
    expect(
      Reflect.getMetadata(GUARDS_METADATA, TripActivityController),
    ).toContain(JwtAuthGuard));
  it("hides activity from outsiders and removed members", async () => {
    query.mockResolvedValueOnce([]);
    await expect(service.list("outsider", "trip", 0)).rejects.toThrow(
      "Trip not found",
    );
    expect(query).toHaveBeenCalledTimes(1);
  });
  it("does not let outsiders change notification settings", async () => {
    query.mockResolvedValueOnce([]);
    await expect(service.mute("outsider", "trip", true)).rejects.toThrow(
      "Trip not found",
    );
    expect(query).toHaveBeenCalledTimes(1);
  });
  it("updates only the caller preference", async () => {
    query.mockResolvedValueOnce([{ id: "trip" }]).mockResolvedValueOnce([]);
    expect(await service.mute("member", "trip", true)).toEqual({ muted: true });
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining("ON CONFLICT(trip_id,user_id)"),
      ["trip", "member", true],
    );
  });
  it("keeps history visible for muted members and bounds pages", async () => {
    query
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce(Array.from({ length: 21 }, (_, id) => ({ id })))
      .mockResolvedValueOnce([{ muted: true }]);
    const result = await service.list("member", "trip", 1);
    expect(result).toMatchObject({ muted: true, hasMore: true });
    expect(result.items).toHaveLength(20);
    expect(query.mock.calls[1][1]).toEqual(["trip", 20]);
  });
  it("targets current members, excluding the actor and muted users", async () => {
    query.mockResolvedValue([]);
    await recordTripActivity(
      m,
      "trip",
      "actor",
      "suggested",
      "Beach",
      "trip-suggestion-s",
    );
    const [sql, args] = query.mock.calls[1];
    expect(sql).toContain("itinerary_collaborators");
    expect(sql).toContain("members.user_id<>$2");
    expect(sql).toContain("p.muted=true");
    expect(args).toEqual([
      "trip",
      "actor",
      "New trip suggestion",
      "Beach was suggested for your trip. Cast your vote.",
      "/trips/trip#trip-suggestion-s",
    ]);
  });
  it("propagates notification failure so the enclosing action rolls back", async () => {
    query
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("database unavailable"));
    await expect(
      recordTripActivity(m, "t", "u", "added", "Beach", "trip-stop-p"),
    ).rejects.toThrow("database unavailable");
  });
  it.each([{ inserted: [] }, { inserted: [{ id: "s" }] }])(
    "records a suggestion only when newly inserted: %j",
    async ({ inserted }) => {
      query
        .mockResolvedValueOnce([{ user_id: "u", duration_days: 3 }])
        .mockResolvedValueOnce([{ title: "Beach" }])
        .mockResolvedValueOnce([{ n: 0 }])
        .mockResolvedValueOnce(inserted)
        .mockResolvedValue([]);
      const voting = new TripVotingService(db, {} as ItinerariesService);
      await voting.suggest("u", "t", { placeId: "p", day: 1 });
      expect(
        query.mock.calls.filter(([sql]) =>
          sql.includes("INSERT INTO trip_activity("),
        ),
      ).toHaveLength(inserted.length);
    },
  );
});
