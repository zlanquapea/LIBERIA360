import { ConflictException, NotFoundException } from "@nestjs/common";
import { CollectionsService } from "./collections.service";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { SaveCollectionDto } from "./collection.dto";
describe("account collections", () => {
  const repo = {
    find: jest.fn(),
    findOneBy: jest.fn(),
    countBy: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
    delete: jest.fn(),
  };
  const manager = { query: jest.fn(), getRepository: () => repo };
  const db = {
    transaction: (fn: (m: typeof manager) => unknown) => fn(manager),
    getRepository: () => repo,
  };
  const service = new CollectionsService(db as never);
  const dto = { name: "Weekend", items: [], version: 0 };
  beforeEach(() => {
    jest.clearAllMocks();
    repo.findOneBy.mockResolvedValue(null);
    repo.countBy.mockResolvedValue(0);
  });
  it("scopes the list and deletion to the signed-in account", async () => {
    await service.list("owner");
    expect(repo.find).toHaveBeenCalledWith({
      where: { userId: "owner" },
      order: { name: "ASC" },
    });
    repo.delete.mockResolvedValue({ affected: 0 });
    await expect(service.remove("other", "id")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.delete).toHaveBeenCalledWith({ id: "id", userId: "other" });
  });
  it("prevents another account from overwriting an existing collection", async () => {
    repo.findOneBy.mockResolvedValue({ userId: "owner", version: 1 });
    await expect(service.save("other", "id", dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });
  it("rejects stale edits instead of losing changes from another device", async () => {
    repo.findOneBy.mockResolvedValue({ userId: "owner", version: 2 });
    await expect(
      service.save("owner", "id", { ...dto, version: 1 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it("defaults to private, enables and revokes a public link", async () => {
    const row = await service.save("owner", "id", dto);
    expect(row.shareToken).toBeNull();
    repo.findOneBy.mockResolvedValue(row);
    const shared = await service.save("owner", "id", {
      ...dto,
      version: 1,
      shared: true,
    });
    expect(shared.shareToken).toMatch(/^[\da-f-]{36}$/);
    const stopped = await service.save("owner", "id", {
      ...dto,
      version: 2,
      shared: false,
    });
    expect(stopped.shareToken).toBeNull();
  });
  it("limits collections under the account lock", async () => {
    repo.countBy.mockResolvedValue(30);
    await expect(service.save("owner", "id", dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(manager.query).toHaveBeenCalled();
  });
  it("only exposes name and items to shared viewers", async () => {
    repo.findOneBy.mockResolvedValue({
      name: "Weekend",
      items: [],
      userId: "private",
      version: 1,
    });
    expect(await service.shared("token")).toEqual({
      name: "Weekend",
      items: [],
    });
    repo.findOneBy.mockResolvedValue(null);
    await expect(service.shared("revoked")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
  it("rejects external links and malformed nested items", async () => {
    const invalid = plainToInstance(SaveCollectionDto, {
      ...dto,
      items: [{ title: "bad", path: "https://evil.example" }],
    });
    expect((await validate(invalid)).length).toBeGreaterThan(0);
    expect(
      await validate(
        plainToInstance(SaveCollectionDto, {
          ...dto,
          items: [{ title: "Beach", path: "/places/beach" }],
        }),
      ),
    ).toEqual([]);
  });
});
