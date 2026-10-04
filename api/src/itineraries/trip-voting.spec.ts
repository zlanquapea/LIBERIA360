import { DataSource } from "typeorm";
import { TripVotingService } from "./trip-voting.service";
import { ItinerariesService } from "./itineraries.service";
import { TripVotingController } from "./trip-voting.controller";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
describe("Trip voting permissions and repeat requests", () => {
  const query = jest.fn();
  const addStop = jest.fn();
  const service = new TripVotingService(
    {
      manager: { query },
      query,
      transaction: (fn: any) => fn({ query }),
    } as unknown as DataSource,
    { addStop } as unknown as ItinerariesService,
  );
  beforeEach(() => {
    query.mockReset();
    addStop.mockReset();
  });
  it("requires authentication for every route", () =>
    expect(
      Reflect.getMetadata(GUARDS_METADATA, TripVotingController),
    ).toContain(JwtAuthGuard));
  it("hides suggestions from nonmembers", async () => {
    query
      .mockResolvedValueOnce([{ user_id: "owner" }])
      .mockResolvedValueOnce([]);
    await expect(service.list("stranger", "trip")).rejects.toThrow(
      "Trip not found",
    );
    expect(query).toHaveBeenCalledTimes(2);
  });
  it("lets members vote idempotently", async () => {
    query
      .mockResolvedValueOnce([{ user_id: "owner" }])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{ id: "suggestion" }])
      .mockResolvedValueOnce([]);
    await service.vote("member", "trip", "suggestion", true);
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining("ON CONFLICT DO NOTHING"),
      ["suggestion", "member"],
    );
  });
  it("withdraws only the caller vote", async () => {
    query
      .mockResolvedValueOnce([{ user_id: "owner" }])
      .mockResolvedValueOnce([{ id: "s" }])
      .mockResolvedValueOnce([]);
    await service.vote("owner", "trip", "s", false);
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining("user_id=$2"),
      ["s", "owner"],
    );
  });
  it("rejects suggestion IDs belonging to another trip", async () => {
    query
      .mockResolvedValueOnce([{ user_id: "owner" }])
      .mockResolvedValueOnce([]);
    await expect(
      service.vote("owner", "trip", "foreign", true),
    ).rejects.toThrow("Suggestion not found");
  });
  it("prevents members from choosing a winner", async () => {
    query
      .mockResolvedValueOnce([{ user_id: "owner" }])
      .mockResolvedValueOnce([{}]);
    await expect(service.choose("member", "trip", "s")).rejects.toThrow(
      "Only the trip owner",
    );
    expect(addStop).not.toHaveBeenCalled();
  });
  it("uses existing itinerary validation when owner adds a suggestion", async () => {
    query
      .mockResolvedValueOnce([{ user_id: "owner" }])
      .mockResolvedValueOnce([{ input: { placeId: "place", day: 1 } }]);
    await service.choose("owner", "trip", "s");
    expect(addStop).toHaveBeenCalledWith("owner", "trip", {
      placeId: "place",
      day: 1,
    });
  });
  it("prevents removing another member suggestion", async () => {
    query
      .mockResolvedValueOnce([{ user_id: "owner" }])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{ user_id: "author" }]);
    await expect(service.remove("member", "trip", "s")).rejects.toThrow(
      "Only the author",
    );
  });
  it("rejects ambiguous targets", async () => {
    await expect(
      service.suggest("owner", "trip", { placeId: "p", eventId: "e", day: 1 }),
    ).rejects.toThrow("Choose one");
    expect(query).not.toHaveBeenCalled();
  });
  it("rejects days outside trip", async () => {
    query.mockResolvedValueOnce([{ user_id: "owner", duration_days: 2 }]);
    await expect(
      service.suggest("owner", "trip", { placeId: "p", day: 3 }),
    ).rejects.toThrow("Choose a day");
  });
  it("does not mutate cancelled trip votes", async () => {
    query.mockResolvedValueOnce([{ user_id: "owner", cancelled_at: "today" }]);
    await expect(service.vote("owner", "trip", "s", true)).rejects.toThrow(
      "cancelled",
    );
    expect(query).toHaveBeenCalledTimes(1);
  });
});
