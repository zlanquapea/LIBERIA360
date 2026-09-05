import { NotFoundException } from "@nestjs/common";
import { SavedPlacesService } from "./saved-places.service";

const USER_ID = "user-1";

function setup() {
  const savedRows: Array<{
    id: string;
    userId: string;
    placeId: string;
    createdAt: Date;
  }> = [];
  const places = [
    { id: "place-1", slug: "ceecee-beach" },
    { id: "place-2", slug: "sapo-national-park" },
    { id: "place-3", slug: "providence-island" },
  ];

  const savedPlaceRepo = {
    find: jest.fn(({ where }: any) =>
      Promise.resolve(
        savedRows
          .filter((row) => row.userId === where.userId)
          .map((row) => ({
            ...row,
            place: places.find((p) => p.id === row.placeId) ?? null,
          }))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      ),
    ),
    upsert: jest.fn((rows: any) => {
      const list = Array.isArray(rows) ? rows : [rows];
      for (const { userId, placeId } of list) {
        const existing = savedRows.find(
          (row) => row.userId === userId && row.placeId === placeId,
        );
        if (!existing) {
          savedRows.push({
            id: `saved-${savedRows.length + 1}`,
            userId,
            placeId,
            createdAt: new Date(Date.now() + savedRows.length),
          });
        }
      }
      return Promise.resolve(undefined);
    }),
    delete: jest.fn(({ userId, placeId }: any) => {
      const idx = savedRows.findIndex(
        (row) => row.userId === userId && row.placeId === placeId,
      );
      if (idx >= 0) savedRows.splice(idx, 1);
      return Promise.resolve({ affected: idx >= 0 ? 1 : 0 });
    }),
  };

  const placeRepo = {
    findOne: jest.fn(({ where }: any) =>
      Promise.resolve(places.find((p) => p.id === where.id) ?? null),
    ),
    find: jest.fn(({ where }: any) => {
      const slugs: string[] = where.slug._value ?? where.slug;
      return Promise.resolve(places.filter((p) => slugs.includes(p.slug)));
    }),
  };

  const service = new SavedPlacesService(
    savedPlaceRepo as any,
    placeRepo as any,
  );
  return { service, savedPlaceRepo, placeRepo, savedRows, places };
}

describe("SavedPlacesService", () => {
  describe("savePlace / unsavePlace / listSlugsForUser", () => {
    it("saves a place and lists it back by slug", async () => {
      const { service } = setup();
      await service.savePlace(USER_ID, "place-1");
      expect(await service.listSlugsForUser(USER_ID)).toEqual(["ceecee-beach"]);
    });

    it("rejects saving an unknown place", async () => {
      const { service } = setup();
      await expect(
        service.savePlace(USER_ID, "no-such-place"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("is idempotent — saving the same place twice does not duplicate it", async () => {
      const { service, savedRows } = setup();
      await service.savePlace(USER_ID, "place-1");
      await service.savePlace(USER_ID, "place-1");
      expect(savedRows).toHaveLength(1);
    });

    it("unsaves a place", async () => {
      const { service } = setup();
      await service.savePlace(USER_ID, "place-1");
      await service.unsavePlace(USER_ID, "place-1");
      expect(await service.listSlugsForUser(USER_ID)).toEqual([]);
    });

    it("unsaving something never saved is a no-op, not an error", async () => {
      const { service } = setup();
      await expect(
        service.unsavePlace(USER_ID, "place-1"),
      ).resolves.toBeUndefined();
    });

    it("only lists the current user's saved places, never another account's", async () => {
      const { service } = setup();
      await service.savePlace(USER_ID, "place-1");
      await service.savePlace("someone-else", "place-2");
      expect(await service.listSlugsForUser(USER_ID)).toEqual(["ceecee-beach"]);
    });
  });

  describe("syncFromDevice", () => {
    it("folds unsynced local slugs into the account and returns the merged list", async () => {
      const { service } = setup();
      await service.savePlace(USER_ID, "place-1");
      const merged = await service.syncFromDevice(USER_ID, [
        "ceecee-beach", // already saved on the account — no-op
        "sapo-national-park", // new to the account
      ]);
      expect(merged.sort()).toEqual(
        ["ceecee-beach", "sapo-national-park"].sort(),
      );
    });

    it("silently drops an unknown/stale slug rather than failing the merge", async () => {
      const { service } = setup();
      const merged = await service.syncFromDevice(USER_ID, [
        "sapo-national-park",
        "a-place-that-no-longer-exists",
      ]);
      expect(merged).toEqual(["sapo-national-park"]);
    });

    it("handles an empty local list (a brand-new device) without error", async () => {
      const { service } = setup();
      await service.savePlace(USER_ID, "place-3");
      expect(await service.syncFromDevice(USER_ID, [])).toEqual([
        "providence-island",
      ]);
    });
  });
});
