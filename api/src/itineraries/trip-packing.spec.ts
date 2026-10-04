import { DataSource } from "typeorm";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { TripPackingController } from "./trip-packing.controller";
import { TripPackingService } from "./trip-packing.service";
import { SaveTripPackingDto } from "./trip-packing.dto";
const fixture = (): SaveTripPackingDto => ({
  version: 0,
  items: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Charger",
      category: "gear",
      quantity: 1,
      packed: false,
    },
  ],
});
describe("Personal trip packing lists", () => {
  const query = jest.fn();
  const service = new TripPackingService({
    query,
    manager: { query },
    transaction: (fn: any) => fn({ query }),
  } as unknown as DataSource);
  beforeEach(() => query.mockReset());
  it("requires authentication on every route", () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, TripPackingController),
    ).toContain(JwtAuthGuard);
  });
  it("denies access to a nonmember without reading private lists", async () => {
    query
      .mockResolvedValueOnce([{ user_id: "owner" }])
      .mockResolvedValueOnce([]);
    await expect(service.get("outsider", "trip")).rejects.toThrow(
      "Trip not found",
    );
    expect(query).toHaveBeenCalledTimes(2);
  });
  it("reads only the caller’s checklist, even for the trip owner", async () => {
    query
      .mockResolvedValueOnce([{ user_id: "owner" }])
      .mockResolvedValueOnce([]);
    expect(await service.get("owner", "trip")).toEqual({
      version: 0,
      items: [],
    });
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining("trip_id = $1 AND user_id = $2"),
      ["trip", "owner"],
    );
  });
  it("lets viewer members update their personal list without editing the trip", async () => {
    query
      .mockResolvedValueOnce([{ user_id: "owner" }])
      .mockResolvedValueOnce([{ role: "viewer" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const result = await service.save("viewer", "trip", fixture());
    expect(result.version).toBe(1);
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining("INSERT INTO trip_packing_lists"),
      ["trip", "viewer", JSON.stringify(fixture().items), 1],
    );
    expect(
      query.mock.calls.some(([sql]) => sql.startsWith("UPDATE itineraries")),
    ).toBe(false);
  });
  it("rejects stale writes and locks initial creation", async () => {
    query
      .mockResolvedValueOnce([{ user_id: "owner" }])
      .mockResolvedValueOnce([{ version: 3 }]);
    await expect(service.save("owner", "trip", fixture())).rejects.toThrow(
      "another device",
    );
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("FOR UPDATE"),
      ["trip"],
    );
    expect(query).toHaveBeenCalledTimes(2);
  });
  it("checks membership again on saves", async () => {
    query
      .mockResolvedValueOnce([{ user_id: "owner" }])
      .mockResolvedValueOnce([]);
    await expect(
      service.save("removed-member", "trip", fixture()),
    ).rejects.toThrow("Trip not found");
    expect(query).toHaveBeenCalledTimes(2);
  });
  it("rejects duplicate IDs, duplicate names, and blank names", async () => {
    const data = fixture();
    data.items.push({ ...data.items[0] });
    await expect(service.save("owner", "trip", data)).rejects.toThrow(
      "unique ID",
    );
    data.items[1].id = "22222222-2222-4222-8222-222222222222";
    data.items[1].name = " CHARGER ";
    await expect(service.save("owner", "trip", data)).rejects.toThrow(
      "already on your list",
    );
    data.items = [{ ...data.items[0], name: "  " }];
    await expect(service.save("owner", "trip", data)).rejects.toThrow(
      "needs a name",
    );
    expect(query).not.toHaveBeenCalled();
  });
  it.each([0, 100, 1.5])("rejects invalid quantity %s", async (quantity) => {
    const data = fixture();
    data.items[0].quantity = quantity;
    expect(
      (await validate(plainToInstance(SaveTripPackingDto, data))).length,
    ).toBeGreaterThan(0);
  });
  it("rejects nonboolean progress and oversized lists", async () => {
    const data = fixture();
    data.items[0].packed = "true" as never;
    expect(
      (await validate(plainToInstance(SaveTripPackingDto, data))).length,
    ).toBeGreaterThan(0);
    data.items = Array.from({ length: 201 }, () => fixture().items[0]);
    expect(
      (await validate(plainToInstance(SaveTripPackingDto, data))).length,
    ).toBeGreaterThan(0);
  });
});
