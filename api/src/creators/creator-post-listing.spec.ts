import { CreatorFeedService } from "./creator-feed.service";
import { CreatorPostMediaType } from "./entities/creator-post.enums";

it("persists and serializes a listing, keeps it during caption edits, and supports removal", async () => {
  const creator = { id: "creator", userId: "owner" };
  let stored: any;
  const repo: any = {
    create: jest.fn(value => value),
    save: jest.fn(async value => { stored = { ...value, id: "post", creator }; return stored; }),
    findOne: jest.fn(async () => stored),
    findOneOrFail: jest.fn(async () => stored),
  };
  const service = new CreatorFeedService({ findOne: jest.fn(async () => creator) } as any, repo, {} as any, {} as any, {} as any, {} as any, {} as any);
  const created = await service.create("owner", { mediaType: CreatorPostMediaType.TEXT, mediaUrl: "", caption: "Visit", relatedPath: "/places/robertsport", relatedLabel: "Robertsport" });
  expect(created).toMatchObject({ relatedPath: "/places/robertsport", relatedLabel: "Robertsport" });
  expect(await service.update("owner", "post", { caption: "Updated" })).toMatchObject({ relatedPath: "/places/robertsport" });
  await expect(service.update("other-user", "post", { relatedPath: "" })).rejects.toThrow("isn't yours");
  expect(await service.update("owner", "post", { relatedPath: "" })).toMatchObject({ relatedPath: null, relatedLabel: null });
});
